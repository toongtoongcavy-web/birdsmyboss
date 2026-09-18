import assert from "node:assert/strict";
import test from "node:test";
import { Firestore, Timestamp } from "firebase-admin/firestore";
import { cancelReservation, cancelSale, completeSale, confirmSale, createCustomer, createPriceHistory, createReservation, createSale, expireReservation, recordPayment, refundPayment } from "../src/services/commercial.js";
import { completeHandover, createDelivery } from "../src/services/phase4.js";
import { getBirdDetails, listBirdPriceHistory, listReservations, listSaleTimeline } from "../src/services/reads.js";

const db = new Firestore({ projectId: "birdsmyboss-v1-dev" });
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
let sequence = 0;
const key = (v: string) => `${v}-${suffix}-${sequence++}`;
const stamp = { createdAt: new Date(), updatedAt: new Date() };
const customer = () => createCustomer(db, { displayName: key("Customer") });
const bird = async () => { const birdId = key("bird"); await db.collection("birds").doc(birdId).set({ ringId: key("ring"), origin: "external", displayName: birdId, status: "active", ...stamp }); return birdId; };

test("commercial invariants: terminal birds remain readable but cannot re-enter Reservation or Direct Sale", async () => {
  const { customerId } = await customer();
  for (const status of ["sold", "given_away", "deceased", "lost"]) {
    const birdId = await bird(); await db.collection("birds").doc(birdId).update({ status });
    assert.equal((await getBirdDetails(db, { birdId })).status, status);
    await assert.rejects(createReservation(db, { birdId, customerId, reservedOn: "2026-09-18" }), /no longer available/);
    await assert.rejects(createSale(db, { birdId, customerId, createdOn: "2026-09-18" }), /no longer available/);
  }
});

test("commercial eligibility follows active Reservations and every non-cancelled Sale state", async () => {
  const { customerId } = await customer();

  const reservedBird = await bird();
  const reservation = await createReservation(db, { birdId: reservedBird, customerId, reservedOn: "2026-09-19" });
  await assert.rejects(createReservation(db, { birdId: reservedBird, customerId, reservedOn: "2026-09-19" }), /active reservation/);
  await assert.rejects(createSale(db, { birdId: reservedBird, customerId, createdOn: "2026-09-19" }), /convert that reservation/);
  const converted = await createSale(db, { birdId: reservedBird, customerId, reservationId: reservation.reservationId, createdOn: "2026-09-19", agreedPrice: 1000, currency: "THB" });
  assert.equal((await db.collection("sales").doc(converted.saleId).get()).data()?.status, "confirmed");

  for (const status of ["draft", "confirmed", "completed"]) {
    const committedBird = await bird();
    await db.collection("sales").doc(key(`${status}-sale`)).set({ birdId: committedBird, customerId, status, createdOn: "2026-09-19", ...stamp });
    await assert.rejects(createReservation(db, { birdId: committedBird, customerId, reservedOn: "2026-09-19" }), /sale/);
    await assert.rejects(createSale(db, { birdId: committedBird, customerId, createdOn: "2026-09-19" }), /sale/);
  }

  const cancelledReservationBird = await bird();
  await db.collection("sales").doc(key("cancelled-reservation-sale")).set({ birdId: cancelledReservationBird, customerId, status: "cancelled", createdOn: "2026-09-19", ...stamp });
  assert.ok((await createReservation(db, { birdId: cancelledReservationBird, customerId, reservedOn: "2026-09-19" })).reservationId);

  const cancelledDirectBird = await bird();
  await db.collection("sales").doc(key("cancelled-direct-sale")).set({ birdId: cancelledDirectBird, customerId, status: "cancelled", createdOn: "2026-09-19", ...stamp });
  assert.ok((await createSale(db, { birdId: cancelledDirectBird, customerId, createdOn: "2026-09-19" })).saleId);
});

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
  const { customerId } = await customer(); const birdId = await bird(); const { reservationId } = await createReservation(db, { birdId, customerId, reservedOn: "2026-01-01", agreedPrice: 100, currency: "THB" }); const { paymentId } = await recordPayment(db, { reservationId, amount: 100, currency: "THB", receivedOn: "2026-01-01", paymentMethod: "transfer" });
  const { saleId } = await createSale(db, { birdId, customerId, reservationId, createdOn: "2026-01-02" }); const sale = await db.collection("sales").doc(saleId).get(); assert.equal(sale.data()?.reservationId, reservationId); assert.equal(sale.data()?.status, "confirmed");
  await assert.rejects(confirmSale(db, { saleId })); await completeSale(db, { saleId, completedOn: "2026-01-03" }); assert.equal((await db.collection("reservations").doc(reservationId).get()).data()?.status, "completed"); assert.equal((await db.collection("payments").doc(paymentId).get()).exists, true);
  const timeline = await db.collection("saleTimeline").where("saleId", "==", saleId).get(); assert.deepEqual(timeline.docs.map((d) => d.data().eventType).sort(), ["sale_completed", "sale_created"]); assert.equal((await db.collection("sales").doc(saleId).get()).data()?.status, "completed");
  await assert.rejects(createSale(db, { birdId, customerId, createdOn: "2026-01-04" }));
});

test("commercial: linked Reservation deposits enforce the Sale balance transactionally", async () => {
  const { customerId } = await customer(); const birdId = await bird();
  const { reservationId } = await createReservation(db, { birdId, customerId, reservedOn: "2026-09-01", agreedPrice: 1000, currency: "THB" });
  const deposit = await recordPayment(db, { reservationId, amount: 200, currency: "THB", receivedOn: "2026-09-01", paymentMethod: "transfer" });
  const { saleId } = await createSale(db, { birdId, customerId, reservationId, createdOn: "2026-09-09" });
  await assert.rejects(recordPayment(db, { reservationId, amount: 1, currency: "THB", receivedOn: "2026-09-09", paymentMethod: "cash" }), /record further payments on the sale/);
  await assert.rejects(recordPayment(db, { saleId, amount: 801, currency: "THB", receivedOn: "2026-09-09", paymentMethod: "cash" }), /remaining agreement balance/);
  const balancePayment = await recordPayment(db, { saleId, amount: 800, currency: "THB", receivedOn: "2026-09-09", paymentMethod: "cash" });
  await assert.rejects(recordPayment(db, { saleId, amount: 1, currency: "THB", receivedOn: "2026-09-09", paymentMethod: "cash" }), /remaining agreement balance/);
  await refundPayment(db, { paymentId: balancePayment.paymentId, outcome: "partial_refund", amount: 100, reason: "adjustment", refundedOn: "2026-09-10" });
  await recordPayment(db, { saleId, amount: 100, currency: "THB", receivedOn: "2026-09-10", paymentMethod: "transfer" });
  assert.equal((await db.collection("payments").doc(deposit.paymentId).get()).data()?.reservationId, reservationId);

  const unpricedBird = await bird(); const unpricedReservation = await createReservation(db, { birdId: unpricedBird, customerId, reservedOn: "2026-09-01" });
  await recordPayment(db, { reservationId: unpricedReservation.reservationId, amount: 200, currency: "THB", receivedOn: "2026-09-01", paymentMethod: "transfer" });
  await assert.rejects(createSale(db, { birdId: unpricedBird, customerId, reservationId: unpricedReservation.reservationId, agreedPrice: 199, currency: "THB", createdOn: "2026-09-09" }), /payments exceed the Sale agreement price/);

  const concurrentBird = await bird(); const concurrentReservation = await createReservation(db, { birdId: concurrentBird, customerId, reservedOn: "2026-09-01", agreedPrice: 100, currency: "THB" }); const concurrentSale = await createSale(db, { birdId: concurrentBird, customerId, reservationId: concurrentReservation.reservationId, createdOn: "2026-09-09" });
  const retries = await Promise.allSettled([recordPayment(db, { saleId: concurrentSale.saleId, amount: 100, currency: "THB", receivedOn: "2026-09-09", paymentMethod: "cash" }), recordPayment(db, { saleId: concurrentSale.saleId, amount: 100, currency: "THB", receivedOn: "2026-09-09", paymentMethod: "cash" })]);
  assert.equal(retries.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal((await db.collection("payments").where("saleId", "==", concurrentSale.saleId).get()).size, 1);
});

test("commercial: completion requires zero net balance including Reservation deposits and refunds", async () => {
  const { customerId } = await customer(); const birdId = await bird();
  const { reservationId } = await createReservation(db, { birdId, customerId, reservedOn: "2026-09-01", agreedPrice: 1000, currency: "THB" });
  await recordPayment(db, { reservationId, amount: 200, currency: "THB", receivedOn: "2026-09-01", paymentMethod: "transfer" });
  const { saleId } = await createSale(db, { birdId, customerId, reservationId, createdOn: "2026-09-09" });
  await assert.rejects(completeSale(db, { saleId, completedOn: "2026-09-10" }), /fully paid/);
  const payment = await recordPayment(db, { saleId, amount: 800, currency: "THB", receivedOn: "2026-09-09", paymentMethod: "cash" });
  await refundPayment(db, { paymentId: payment.paymentId, outcome: "partial_refund", amount: 100, reason: "adjustment", refundedOn: "2026-09-10" });
  await assert.rejects(completeSale(db, { saleId, completedOn: "2026-09-10" }), /fully paid/);
  await recordPayment(db, { saleId, amount: 100, currency: "THB", receivedOn: "2026-09-10", paymentMethod: "transfer" });
  await completeSale(db, { saleId, completedOn: "2026-09-10" });
  assert.equal((await db.collection("sales").doc(saleId).get()).data()?.status, "completed");
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

test("commercial: overdue Reservations expire authoritatively while converted history does not", async () => {
  const { customerId } = await customer();
  const overdueBird = await bird(); const overdueId = key("overdue-reservation");
  await db.collection("reservations").doc(overdueId).set({ birdId: overdueBird, customerId, reservedOn: "2026-09-09", expiresOn: "2026-09-10", status: "active", ...stamp });
  const listed = await listReservations(db, { limit: 50 });
  assert.equal(listed.find((reservation) => reservation.reservationId === overdueId)?.status, "expired");
  assert.equal((await db.collection("reservations").doc(overdueId).get()).data()?.status, "expired");
  await assert.rejects(recordPayment(db, { reservationId: overdueId, amount: 1, currency: "THB", receivedOn: "2026-09-15", paymentMethod: "cash" }), /expired or inactive/);
  await assert.rejects(createSale(db, { birdId: overdueBird, customerId, reservationId: overdueId, createdOn: "2026-09-15", agreedPrice: 1000, currency: "THB" }), /expired or inactive/);

  const convertedBird = await bird(); const convertedId = key("converted-reservation"); const convertedSaleId = key("converted-sale");
  await db.collection("reservations").doc(convertedId).set({ birdId: convertedBird, customerId, reservedOn: "2026-09-09", expiresOn: "2026-09-10", status: "active", ...stamp });
  await db.collection("sales").doc(convertedSaleId).set({ birdId: convertedBird, customerId, reservationId: convertedId, createdOn: "2026-09-09", status: "confirmed", ...stamp });
  const convertedHistory = await listReservations(db, { limit: 50 });
  assert.equal(convertedHistory.find((reservation) => reservation.reservationId === convertedId)?.status, "active");
  assert.equal((await db.collection("reservations").doc(convertedId).get()).data()?.status, "active");
  await assert.rejects(expireReservation(db, { reservationId: convertedId, expiredOn: "2026-09-15" }), /non-cancelled sale/);
});

test("commercial: availability, sale transitions, delivery and handover boundaries", async () => {
  const { customerId } = await customer(); const birdId = await bird();
  await db.collection("customers").doc(customerId).update({ status: "archived" });
  await assert.rejects(createReservation(db, { birdId, customerId, reservedOn: "2026-01-01" }));
  await db.collection("customers").doc(customerId).update({ status: "active" });
  const first = await createSale(db, { birdId, customerId, createdOn: "2026-01-01", agreedPrice: 10, currency: "THB" });
  await assert.rejects(createSale(db, { birdId, customerId, createdOn: "2026-01-02" }));
  await assert.rejects(completeSale(db, { saleId: first.saleId, completedOn: "2026-01-03" }));
  await assert.rejects(createDelivery(db, { saleId: first.saleId, createdOn: "2026-01-03", distanceKm: 1, freeDistanceKm: 0, pricePerKm: 10, currency: "THB" }));
  await confirmSale(db, { saleId: first.saleId }); await recordPayment(db, { saleId: first.saleId, amount: 10, currency: "THB", receivedOn: "2026-01-03", paymentMethod: "cash" }); await completeSale(db, { saleId: first.saleId, completedOn: "2026-01-03" });
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
  await assert.rejects(confirmSale(db, { saleId: next.saleId })); await cancelSale(db, { saleId: next.saleId });
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
  await assert.rejects(createSale(db, { birdId: pricedBird, customerId, reservationId: reservation.reservationId, createdOn: "2026-01-02", agreedPrice: 1 }));
  await assert.rejects(createSale(db, { birdId: pricedBird, customerId, reservationId: reservation.reservationId, createdOn: "2026-01-02", currency: "THB" }));
  await assert.rejects(createSale(db, { birdId: pricedBird, customerId, reservationId: reservation.reservationId, createdOn: "2026-01-02", agreedPrice: 1, currency: "THB" }));
  const converted = await createSale(db, { birdId: pricedBird, customerId, reservationId: reservation.reservationId, createdOn: "2026-01-02" });
  const convertedDoc = await db.collection("sales").doc(converted.saleId).get();
  assert.equal(convertedDoc.data()?.agreedPrice, 1250.5); assert.equal(convertedDoc.data()?.currency, "THB");
  const convertedFinal = await db.collection("priceHistory").where("saleId", "==", converted.saleId).get();
  assert.equal(convertedFinal.size, 1); const convertedFinalData = convertedFinal.docs[0].data(); assert.deepEqual({ birdId: convertedFinalData.birdId, amount: convertedFinalData.amount, currency: convertedFinalData.currency, effectiveOn: convertedFinalData.effectiveOn, kind: convertedFinalData.kind, sourceType: convertedFinalData.sourceType, saleId: convertedFinalData.saleId }, { birdId: pricedBird, amount: 1250.5, currency: "THB", effectiveOn: "2026-01-02", kind: "final", sourceType: "sale", saleId: converted.saleId });
  const unpricedSale = await createSale(db, { birdId: unpricedBird, customerId, reservationId: noPrice.reservationId, createdOn: "2026-01-02" });
  assert.equal((await db.collection("sales").doc(unpricedSale.saleId).get()).data()?.agreedPrice, undefined);
  const fallbackBird = await bird(); const fallbackReservation = await createReservation(db, { birdId: fallbackBird, ...base });
  const fallbackPayload = { birdId: fallbackBird, customerId, reservationId: fallbackReservation.reservationId, createdOn: "2026-09-09", agreedPrice: 1000, currency: "THB" };
  const fallbackSale = await createSale(db, fallbackPayload);
  const fallbackSaleDoc = await db.collection("sales").doc(fallbackSale.saleId).get();
  assert.equal(fallbackSaleDoc.data()?.reservationId, fallbackReservation.reservationId); assert.equal(fallbackSaleDoc.data()?.agreedPrice, 1000); assert.equal(fallbackSaleDoc.data()?.currency, "THB"); assert.equal(fallbackSaleDoc.data()?.createdOn, "2026-09-09"); assert.equal(fallbackSaleDoc.data()?.status, "confirmed");
  await assert.rejects(createSale(db, fallbackPayload), /Bird already has an open sale|Reservation already has a non-cancelled sale/);
  assert.equal((await db.collection("sales").where("reservationId", "==", fallbackReservation.reservationId).get()).size, 1);
  assert.equal((await db.collection("priceHistory").where("saleId", "==", fallbackSale.saleId).get()).size, 1);
  const direct = await createSale(db, { birdId: directBird, customerId, createdOn: "2026-01-02", agreedPrice: 99.99, currency: "THB" });
  assert.equal((await db.collection("sales").doc(direct.saleId).get()).data()?.agreedPrice, 99.99); assert.equal((await db.collection("sales").doc(direct.saleId).get()).data()?.status, "draft");
  assert.equal((await db.collection("priceHistory").where("saleId", "==", direct.saleId).get()).size, 0);
  await confirmSale(db, { saleId: direct.saleId });
  const directFinal = await db.collection("priceHistory").where("saleId", "==", direct.saleId).get();
  assert.equal(directFinal.size, 1); assert.deepEqual({ birdId: directFinal.docs[0].data().birdId, amount: directFinal.docs[0].data().amount, currency: directFinal.docs[0].data().currency, effectiveOn: directFinal.docs[0].data().effectiveOn, kind: directFinal.docs[0].data().kind, sourceType: directFinal.docs[0].data().sourceType, saleId: directFinal.docs[0].data().saleId }, { birdId: directBird, amount: 99.99, currency: "THB", effectiveOn: "2026-01-02", kind: "final", sourceType: "sale", saleId: direct.saleId });
  await assert.rejects(confirmSale(db, { saleId: direct.saleId }), /Only a draft sale/);
  assert.equal((await db.collection("priceHistory").where("saleId", "==", direct.saleId).get()).size, 1);
  await recordPayment(db, { saleId: direct.saleId, amount: 99.99, currency: "THB", receivedOn: "2026-01-03", paymentMethod: "cash" });
  await completeSale(db, { saleId: direct.saleId, completedOn: "2026-01-03" });
  assert.equal((await db.collection("priceHistory").where("saleId", "==", direct.saleId).get()).size, 1);
  const cancelledBird = await bird(); const cancelled = await createSale(db, { birdId: cancelledBird, customerId, createdOn: "2026-01-02", agreedPrice: 88, currency: "THB" });
  await cancelSale(db, { saleId: cancelled.saleId });
  assert.equal((await db.collection("priceHistory").where("saleId", "==", cancelled.saleId).get()).size, 0);
  for (const invalid of [{ agreedPrice: 2 }, { currency: "THB" }, { agreedPrice: 0, currency: "THB" }, { agreedPrice: -1, currency: "THB" }, { agreedPrice: NaN, currency: "THB" }, { agreedPrice: Infinity, currency: "THB" }, { agreedPrice: 2, currency: "USD" }]) await assert.rejects(createSale(db, { birdId: await bird(), customerId, createdOn: "2026-01-02", ...invalid }));
  const manualBird = await bird();
  await createPriceHistory(db, { birdId: manualBird, amount: 1, currency: "THB", effectiveOn: "2026-01-01", kind: "list" });
  await createPriceHistory(db, { birdId: manualBird, amount: 200, currency: "THB", effectiveOn: "2027-01-01", kind: "offer" });
  await assert.rejects(createPriceHistory(db, { birdId: manualBird, amount: 300, currency: "THB", effectiveOn: "2027-01-02", kind: "final" }), /list or offer/);
  await db.collection("priceHistory").doc(key("legacy-final")).set({ birdId: manualBird, amount: 77, currency: "THB", effectiveOn: "2025-01-01", kind: "final", ...stamp });
  await createPriceHistory(db, { birdId: manualBird, amount: 150, currency: "THB", effectiveOn: "2027-01-02", kind: "offer" });
  await assert.rejects(createPriceHistory(db, { birdId: directBird, amount: 1, currency: "THB", effectiveOn: "2027-01-01", kind: "list" }), /locks manual pricing/);
  await assert.rejects(createPriceHistory(db, { birdId: directBird, amount: 1, currency: "THB", effectiveOn: "2027-01-01", kind: "offer" }), /locks manual pricing/);
  const priceHistory = await listBirdPriceHistory(db, { birdId: manualBird });
  assert.deepEqual(priceHistory.map(entry => entry.amount), [150, 200, 1, 77]);
  assert.equal(priceHistory.find(entry => entry.amount === 77)?.kind, "final");
  assert.equal((await db.collection("sales").doc(direct.saleId).get()).data()?.agreedPrice, 99.99);
  await assert.rejects(createPriceHistory(db, { birdId: manualBird, amount: -1, currency: "THB", effectiveOn: "2026-01-01", kind: "list" }));
  await assert.rejects(createPriceHistory(db, { birdId: manualBird, amount: 1, currency: "USD", effectiveOn: "2026-01-01", kind: "list" }));
  const timeline = await listSaleTimeline(db, { saleId: direct.saleId });
  assert.deepEqual(timeline.map(event => event.eventType), ["sale_created", "payment_recorded", "sale_completed"]); assert.equal("payload" in timeline[0], false);
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
