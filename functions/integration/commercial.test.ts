import assert from "node:assert/strict";
import test from "node:test";
import { Firestore, Timestamp } from "firebase-admin/firestore";
import { cancelReservation, cancelSale, completeSale, confirmSale, createCustomer, createPriceHistory, createReservation, createSale, expireReservation, recordPayment, refundPayment } from "../src/services/commercial.js";
import { completeHandover, createDelivery } from "../src/services/phase4.js";
import { listBirdPriceHistory, listSaleTimeline } from "../src/services/reads.js";

const db = new Firestore({ projectId: "birdsmyboss-v1-dev" });
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
let sequence = 0;
const key = (v: string) => `${v}-${suffix}-${sequence++}`;
const stamp = { createdAt: new Date(), updatedAt: new Date() };
const customer = () => createCustomer(db, { displayName: key("Customer") });
const bird = async () => { const birdId = key("bird"); await db.collection("birds").doc(birdId).set({ ringId: key("ring"), origin: "external", displayName: birdId, status: "active", ...stamp }); return birdId; };

test("commercial: customer validation and concurrent reservation allow one active record", async () => {
  await assert.rejects(createCustomer(db, {}));
  const { customerId } = await customer(); const birdId = await bird();
  const results = await Promise.allSettled([createReservation(db, { birdId, customerId, reservedOn: "2026-01-01" }), createReservation(db, { birdId, customerId, reservedOn: "2026-01-01" })]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
});

test("commercial: reservation payment/refunds retain records and never create reservation-only timeline", async () => {
  const { customerId } = await customer(); const birdId = await bird(); const { reservationId } = await createReservation(db, { birdId, customerId, reservedOn: "2026-01-01" });
  const { paymentId } = await recordPayment(db, { reservationId, amount: 100, currency: "THB", receivedOn: "2026-01-01", paymentMethod: "transfer" });
  await assert.rejects(recordPayment(db, { reservationId, saleId: "x", amount: 1, currency: "THB", receivedOn: "2026-01-01", paymentMethod: "transfer" }));
  await assert.rejects(recordPayment(db, { amount: 0, currency: "THB", receivedOn: "2026-01-01", paymentMethod: "transfer" }));
  await assert.rejects(refundPayment(db, { paymentId, outcome: "partial_refund", amount: 100, reason: "must be less than remaining", refundedOn: "2026-01-02" }));
  const partial = await refundPayment(db, { paymentId, outcome: "partial_refund", amount: 40, reason: "operator", refundedOn: "2026-01-02" }); assert.equal(partial.amount, 40);
  const noRefund = await refundPayment(db, { paymentId, outcome: "no_refund", reason: "operator", refundedOn: "2026-01-03" }); assert.equal(noRefund.amount, 0);
  const full = await refundPayment(db, { paymentId, outcome: "full_refund", reason: "operator", refundedOn: "2026-01-04" }); assert.equal(full.amount, 60);
  await assert.rejects(refundPayment(db, { paymentId, outcome: "partial_refund", amount: 1, reason: "operator", refundedOn: "2026-01-05" }));
  assert.equal((await db.collection("payments").doc(paymentId).get()).exists, true); assert.equal((await db.collection("saleTimeline").get()).docs.filter((d) => d.data().saleId === undefined).length, 0);
});

test("commercial: reservation-to-sale preserves records, creates timeline, and completion is unique", async () => {
  const { customerId } = await customer(); const birdId = await bird(); const { reservationId } = await createReservation(db, { birdId, customerId, reservedOn: "2026-01-01" }); const { paymentId } = await recordPayment(db, { reservationId, amount: 100, currency: "THB", receivedOn: "2026-01-01", paymentMethod: "transfer" });
  const { saleId } = await createSale(db, { birdId, customerId, reservationId, createdOn: "2026-01-02" }); const sale = await db.collection("sales").doc(saleId).get(); assert.equal(sale.data()?.reservationId, reservationId);
  await assert.rejects(completeSale(db, { saleId, completedOn: "2026-01-03" })); await confirmSale(db, { saleId }); await completeSale(db, { saleId, completedOn: "2026-01-03" }); assert.equal((await db.collection("reservations").doc(reservationId).get()).data()?.status, "completed"); assert.equal((await db.collection("payments").doc(paymentId).get()).exists, true);
  const timeline = await db.collection("saleTimeline").where("saleId", "==", saleId).get(); assert.deepEqual(timeline.docs.map((d) => d.data().eventType).sort(), ["sale_completed", "sale_created"]); assert.equal((await db.collection("sales").doc(saleId).get()).data()?.status, "completed");
  await assert.rejects(createSale(db, { birdId, customerId, createdOn: "2026-01-04" }));
});

test("commercial: reservation terminal transitions and race-safe sale link rules", async () => {
  const { customerId } = await customer(); const birdId = await bird();
  const { reservationId } = await createReservation(db, { birdId, customerId, reservedOn: "2026-01-01", expiresOn: "2026-01-10" });
  await cancelReservation(db, { reservationId, cancelReason: "operator" });
  await assert.rejects(expireReservation(db, { reservationId, expiredOn: "2026-01-11" }));
  const birdId2 = await bird(); const reservation2 = await createReservation(db, { birdId: birdId2, customerId, reservedOn: "2026-01-01", expiresOn: "2026-01-10" });
  await assert.rejects(expireReservation(db, { reservationId: reservation2.reservationId, expiredOn: "2026-01-09" }));
  await expireReservation(db, { reservationId: reservation2.reservationId, expiredOn: "2026-01-10" });
  const birdId3 = await bird(); const reservation3 = await createReservation(db, { birdId: birdId3, customerId, reservedOn: "2026-01-01" });
  const sale = await createSale(db, { birdId: birdId3, customerId, reservationId: reservation3.reservationId, createdOn: "2026-01-02" });
  await assert.rejects(cancelReservation(db, { reservationId: reservation3.reservationId }));
  await cancelSale(db, { saleId: sale.saleId });
  assert.equal((await db.collection("reservations").doc(reservation3.reservationId).get()).data()?.status, "active");
});

test("commercial: availability, sale transitions, delivery and handover boundaries", async () => {
  const { customerId } = await customer(); const birdId = await bird();
  await db.collection("customers").doc(customerId).update({ status: "archived" });
  await assert.rejects(createReservation(db, { birdId, customerId, reservedOn: "2026-01-01" }));
  await db.collection("customers").doc(customerId).update({ status: "active" });
  const first = await createSale(db, { birdId, customerId, createdOn: "2026-01-01" });
  await assert.rejects(createSale(db, { birdId, customerId, createdOn: "2026-01-02" }));
  await assert.rejects(completeSale(db, { saleId: first.saleId, completedOn: "2026-01-03" }));
  await assert.rejects(createDelivery(db, { saleId: first.saleId, createdOn: "2026-01-03", distanceKm: 1, freeDistanceKm: 0, pricePerKm: 10, currency: "THB" }));
  await confirmSale(db, { saleId: first.saleId }); await completeSale(db, { saleId: first.saleId, completedOn: "2026-01-03" });
  await assert.rejects(cancelSale(db, { saleId: first.saleId }));
  const delivery = await createDelivery(db, { saleId: first.saleId, createdOn: "2026-01-03", distanceKm: 1, freeDistanceKm: 0, pricePerKm: 10, currency: "THB" }); assert.ok(delivery.deliveryId);
  const handover = await completeHandover(db, { sourceType: "sale", saleId: first.saleId, birdId, handoverOn: "2026-01-04", recipientSnapshot: { name: "Recipient" } }); assert.ok(handover.handoverId);
  assert.equal((await db.collection("birds").doc(birdId).get()).data()?.status, "sold");
  await assert.rejects(createSale(db, { birdId, customerId, createdOn: "2026-01-05" }));
});

test("commercial: concurrent no_refund decisions allow one immutable result", async () => {
  const { customerId } = await customer(); const birdId = await bird(); const { reservationId } = await createReservation(db, { birdId, customerId, reservedOn: "2026-01-01" });
  const { paymentId } = await recordPayment(db, { reservationId, amount: 100, currency: "THB", receivedOn: "2026-01-01", paymentMethod: "transfer" });
  const results = await Promise.allSettled([refundPayment(db, { paymentId, outcome: "no_refund", reason: "one", refundedOn: "2026-01-02" }), refundPayment(db, { paymentId, outcome: "no_refund", reason: "two", refundedOn: "2026-01-02" })]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
});

test("commercial: locked eligibility and transition rejections are authoritative", async () => {
  const { customerId } = await customer();
  const soldBirdId = await bird(); await db.collection("birds").doc(soldBirdId).update({ status: "sold" });
  await assert.rejects(createReservation(db, { birdId: soldBirdId, customerId, reservedOn: "2026-01-01" }));
  await assert.rejects(createSale(db, { birdId: soldBirdId, customerId, createdOn: "2026-01-01" }));
  const birdId = await bird(); const { reservationId } = await createReservation(db, { birdId, customerId, reservedOn: "2026-01-01" });
  await assert.rejects(createSale(db, { birdId, customerId, reservationId: "missing", createdOn: "2026-01-02" }));
  const otherBirdId = await bird(); await assert.rejects(createSale(db, { birdId: otherBirdId, customerId, reservationId, createdOn: "2026-01-02" }));
  const otherCustomer = await customer(); await assert.rejects(createSale(db, { birdId, customerId: otherCustomer.customerId, reservationId, createdOn: "2026-01-02" }));
  const { saleId } = await createSale(db, { birdId, customerId, reservationId, createdOn: "2026-01-02" });
  await assert.rejects(createSale(db, { birdId, customerId, reservationId, createdOn: "2026-01-03" }));
  await cancelSale(db, { saleId });
  const next = await createSale(db, { birdId, customerId, reservationId, createdOn: "2026-01-03" });
  await confirmSale(db, { saleId: next.saleId }); await cancelSale(db, { saleId: next.saleId });
  await assert.rejects(confirmSale(db, { saleId: next.saleId })); await assert.rejects(completeSale(db, { saleId: next.saleId, completedOn: "2026-01-04" }));
});

test("commercial: Sale creation and Reservation closure races resolve with one canonical outcome", async () => {
  const { customerId } = await customer(); const birdId = await bird(); const reservation = await createReservation(db, { birdId, customerId, reservedOn: "2026-01-01", expiresOn: "2026-01-02" });
  const cancelRace = await Promise.allSettled([cancelReservation(db, { reservationId: reservation.reservationId }), createSale(db, { birdId, customerId, reservationId: reservation.reservationId, createdOn: "2026-01-02" })]);
  assert.equal(cancelRace.filter((result) => result.status === "fulfilled").length, 1);
  const birdId2 = await bird(); const reservation2 = await createReservation(db, { birdId: birdId2, customerId, reservedOn: "2026-01-01", expiresOn: "2026-01-02" });
  const expireRace = await Promise.allSettled([expireReservation(db, { reservationId: reservation2.reservationId, expiredOn: "2026-01-02" }), createSale(db, { birdId: birdId2, customerId, reservationId: reservation2.reservationId, createdOn: "2026-01-02" })]);
  assert.equal(expireRace.filter((result) => result.status === "fulfilled").length, 1);
  const birdId3 = await bird(); const openSales = await Promise.allSettled([createSale(db, { birdId: birdId3, customerId, createdOn: "2026-01-01" }), createSale(db, { birdId: birdId3, customerId, createdOn: "2026-01-01" })]);
  assert.equal(openSales.filter((result) => result.status === "fulfilled").length, 1);
});

test("commercial: concurrent refunds cannot exceed payment balance", async () => {
  const { customerId } = await customer(); const birdId = await bird(); const { reservationId } = await createReservation(db, { birdId, customerId, reservedOn: "2026-01-01" }); const { paymentId } = await recordPayment(db, { reservationId, amount: 100, currency: "THB", receivedOn: "2026-01-01", paymentMethod: "transfer" });
  const results = await Promise.allSettled([refundPayment(db, { paymentId, outcome: "partial_refund", amount: 70, reason: "one", refundedOn: "2026-01-02" }), refundPayment(db, { paymentId, outcome: "partial_refund", amount: 70, reason: "two", refundedOn: "2026-01-02" })]); assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
});

test("commercial: agreement price snapshots are explicit, copied, and independent from Price History", async () => {
  const { customerId } = await customer();
  const pricedBird = await bird();
  const unpricedBird = await bird();
  const directBird = await bird();
  const base = { customerId, reservedOn: "2026-01-01" };
  const noPrice = await createReservation(db, { birdId: unpricedBird, ...base });
  assert.equal((await db.collection("reservations").doc(noPrice.reservationId).get()).data()?.agreedPrice, undefined);
  const reservation = await createReservation(db, { birdId: pricedBird, ...base, agreedPrice: 1250.5, currency: "THB" });
  const reservationDoc = await db.collection("reservations").doc(reservation.reservationId).get();
  assert.equal(reservationDoc.data()?.agreedPrice, 1250.5); assert.equal(reservationDoc.data()?.currency, "THB");
  for (const invalid of [{ agreedPrice: 1 }, { currency: "THB" }, { agreedPrice: 0, currency: "THB" }, { agreedPrice: -1, currency: "THB" }, { agreedPrice: NaN, currency: "THB" }, { agreedPrice: Infinity, currency: "THB" }, { agreedPrice: 1, currency: "USD" }]) await assert.rejects(createReservation(db, { birdId: await bird(), ...base, ...invalid }));
  const converted = await createSale(db, { birdId: pricedBird, customerId, reservationId: reservation.reservationId, createdOn: "2026-01-02" });
  const convertedDoc = await db.collection("sales").doc(converted.saleId).get();
  assert.equal(convertedDoc.data()?.agreedPrice, 1250.5); assert.equal(convertedDoc.data()?.currency, "THB");
  await assert.rejects(createSale(db, { birdId: pricedBird, customerId, reservationId: reservation.reservationId, createdOn: "2026-01-02", agreedPrice: 1 }));
  await assert.rejects(createSale(db, { birdId: pricedBird, customerId, reservationId: reservation.reservationId, createdOn: "2026-01-02", currency: "THB" }));
  const unpricedSale = await createSale(db, { birdId: unpricedBird, customerId, reservationId: noPrice.reservationId, createdOn: "2026-01-02" });
  assert.equal((await db.collection("sales").doc(unpricedSale.saleId).get()).data()?.agreedPrice, undefined);
  const direct = await createSale(db, { birdId: directBird, customerId, createdOn: "2026-01-02", agreedPrice: 99.99, currency: "THB" });
  assert.equal((await db.collection("sales").doc(direct.saleId).get()).data()?.agreedPrice, 99.99);
  for (const invalid of [{ agreedPrice: 2 }, { currency: "THB" }, { agreedPrice: 0, currency: "THB" }, { agreedPrice: -1, currency: "THB" }, { agreedPrice: NaN, currency: "THB" }, { agreedPrice: Infinity, currency: "THB" }, { agreedPrice: 2, currency: "USD" }]) await assert.rejects(createSale(db, { birdId: await bird(), customerId, createdOn: "2026-01-02", ...invalid }));
  await createPriceHistory(db, { birdId: directBird, amount: 1, currency: "THB", effectiveOn: "2026-01-01", kind: "list" });
  await createPriceHistory(db, { birdId: directBird, amount: 200, currency: "THB", effectiveOn: "2027-01-01", kind: "offer" });
  const priceHistory = await listBirdPriceHistory(db, { birdId: directBird });
  assert.deepEqual(priceHistory.map(entry => entry.amount), [200, 1]);
  assert.equal((await db.collection("sales").doc(direct.saleId).get()).data()?.agreedPrice, 99.99);
  await assert.rejects(createPriceHistory(db, { birdId: directBird, amount: -1, currency: "THB", effectiveOn: "2026-01-01", kind: "list" }));
  await assert.rejects(createPriceHistory(db, { birdId: directBird, amount: 1, currency: "USD", effectiveOn: "2026-01-01", kind: "list" }));
  const timeline = await listSaleTimeline(db, { saleId: direct.saleId });
  assert.equal(timeline.length, 1); assert.equal(timeline[0].eventType, "sale_created"); assert.equal("payload" in timeline[0], false);
});

test("commercial: Sale Timeline DTO normalizes timestamps, omits payload, and remains chronological", async () => {
  const saleId = key("timeline-sale");
  await db.collection("sales").doc(saleId).set({ status: "draft", ...stamp });
  await db.collection("saleTimeline").doc(key("later")).set({ saleId, eventType: "sale_completed", occurredAt: Timestamp.fromDate(new Date("2026-01-03T12:00:00.000Z")), payload: { private: true } });
  await db.collection("saleTimeline").doc(key("earlier")).set({ saleId, eventType: "sale_created", occurredAt: Timestamp.fromDate(new Date("2026-01-02T12:00:00.000Z")), payload: { private: true } });
  const timeline = await listSaleTimeline(db, { saleId });
  assert.deepEqual(timeline.map(event => event.occurredAt), ["2026-01-02", "2026-01-03"]);
  for (const event of timeline) {
    assert.equal(typeof event.occurredAt, "string");
    assert.match(String(event.occurredAt), /^\d{4}-\d{2}-\d{2}$/);
    assert.equal("payload" in event, false);
  }
});
