import assert from "node:assert/strict";
import test from "node:test";
import { Firestore } from "firebase-admin/firestore";
import { cancelReservation, cancelSale, confirmSale, createCustomer, createReservation, createSale, recordPayment, refundPayment } from "../src/services/commercial.js";
import { listSales } from "../src/services/reads.js";

const db = new Firestore({ projectId: "demo-sale-cancellation" });
const date = "2026-11-01";
const decision = (outcome: string, amount?: number) => ({ outcome, reason: "Customer refused before handover", refundedOn: date, ...(amount === undefined ? {} : { amount }) });
const pay = (owner: { saleId?: string; reservationId?: string }, amount: number) => recordPayment(db, { ...(owner.saleId ? { saleId: owner.saleId } : { reservationId: owner.reservationId }), amount, currency: "THB", receivedOn: date, paymentMethod: "cash" });
async function fixture(inherited = false) {
  const birdId = crypto.randomUUID(); await db.collection("birds").doc(birdId).set({ status: "active", origin: "external" });
  const { customerId } = await createCustomer(db, { displayName: "Sale cancellation" });
  const reservation = inherited ? await createReservation(db, { birdId, customerId, reservedOn: date, agreedPrice: 5000, currency: "THB" }) : undefined;
  const deposit = reservation ? await pay(reservation, 2000) : undefined;
  if (deposit) await refundPayment(db, { ...deposit, ...decision("partial_refund", 500) });
  const { saleId } = await createSale(db, { birdId, customerId, createdOn: date, ...(reservation ?? { agreedPrice: 5000, currency: "THB" }) });
  return { saleId, birdId, reservationId: reservation?.reservationId, deposit };
}
const saleData = async (saleId: string) => (await db.collection("sales").doc(saleId).get()).data()!;
const summary = async (saleId: string) => (await listSales(db, { saleId, cancellationSummary: true }))[0] as any;

test("draft and confirmed zero-net Sales cancel, including fully refunded money", async () => {
  for (const confirmed of [false, true]) {
    const f = await fixture(); if (confirmed) await confirmSale(db, f);
    if (confirmed) { const p = await pay(f, 5000); await refundPayment(db, { ...p, ...decision("full_refund") }); }
    await cancelSale(db, f);
    assert.equal((await saleData(f.saleId)).status, "cancelled");
    assert.equal((await summary(f.saleId)).cancellationSummary.netRetained, 0);
  }
});

test("paid Sale rejects missing/invalid disposition and stale reviewed balance without any writes", async () => {
  const f = await fixture(); const p = await pay(f, 5000);
  for (const disposition of [undefined, {}, { outcome: "full_refund" }, { ...decision("no_refund"), reason: " " }, { ...decision("full_refund"), refundedOn: "bad" }, decision("partial_refund", 0), decision("partial_refund", 5000)]) {
    await assert.rejects(cancelSale(db, { ...f, disposition }));
    assert.equal((await saleData(f.saleId)).status, "draft");
    assert.equal((await db.collection("refunds").where("paymentId", "==", p.paymentId).get()).size, 0);
  }
  await assert.rejects(cancelSale(db, { ...f, disposition: decision("full_refund"), expectedNetRetained: 4000 }), /balance changed/);
});

for (const [outcome, amount] of [["full_refund", 5000], ["partial_refund", 4500], ["no_refund", 0]] as const) {
  test(`${outcome}: atomic canonical refund/disposition, retained total, audit and terminal guards`, async () => {
    const f = await fixture(); const p = await pay(f, 5000);
    await cancelSale(db, { ...f, disposition: decision(outcome, outcome === "partial_refund" ? amount : undefined) });
    const sale = await saleData(f.saleId);
    assert.equal(sale.status, "cancelled");
    assert.equal(sale.cancellationDisposition.outcome, outcome);
    assert.equal(sale.cancellationDisposition.reason, decision(outcome).reason);
    assert.equal(sale.cancellationDisposition.refundedOn, date);
    assert.deepEqual(sale.cancellationPaymentIds, [p.paymentId]);
    const records = await db.collection("refunds").where("paymentId", "==", p.paymentId).get();
    assert.equal(records.size, 1); assert.equal(records.docs[0].data().amount, amount);
    assert.equal(records.docs[0].data().outcome, outcome);
    assert.deepEqual((await summary(f.saleId)).cancellationSummary, { grossReceived: 5000, refundTotal: amount, netRetained: 5000 - amount });
    assert.equal((await db.collection("birds").doc(f.birdId).get()).data()?.status, "active");
    assert.equal((await db.collection("handovers").where("saleId", "==", f.saleId).get()).size, 0);
    assert.ok((await db.collection("saleTimeline").where("saleId", "==", f.saleId).get()).docs.some(doc => doc.data().eventType === "sale_cancelled"));
    await assert.rejects(pay(f, 1), /Cancelled sale cannot receive/);
    await assert.rejects(refundPayment(db, { ...p, ...decision("no_refund") }), /explicit settlement workflow/);
    await assert.rejects(cancelSale(db, f), /draft or confirmed/);
  });
}

test("inherited receipts/refunds are counted once; Reservation and Bird remain unchanged; later Reservation funds do not change cancelled Sale scope", async () => {
  const f = await fixture(true); await pay(f, 3500);
  assert.deepEqual((await summary(f.saleId)).cancellationSummary, { grossReceived: 5500, refundTotal: 500, netRetained: 5000 });
  await cancelSale(db, { ...f, disposition: decision("partial_refund", 4500) });
  assert.equal((await summary(f.saleId)).cancellationSummary.netRetained, 500);
  assert.equal((await db.collection("reservations").doc(f.reservationId!).get()).data()?.status, "active");
  assert.equal((await db.collection("payments").doc(f.deposit!.paymentId).get()).data()?.reservationId, f.reservationId);
  await assert.rejects(refundPayment(db, { ...f.deposit!, ...decision("no_refund") }), /explicit settlement workflow/);
  const fresh = await pay({ reservationId: f.reservationId }, 100);
  await refundPayment(db, { ...fresh, ...decision("full_refund") });
  assert.equal((await summary(f.saleId)).cancellationSummary.netRetained, 500);
  // The existing explicit Reservation cancellation path remains available.
  await cancelReservation(db, { reservationId: f.reservationId });
  assert.equal((await db.collection("reservations").doc(f.reservationId!).get()).data()?.status, "cancelled");
});

test("authoritative summary/cancellation includes more than the global-list cap", async () => {
  const f = await fixture();
  const batch = db.batch();
  for (let i = 0; i < 60; i++) batch.create(db.collection("payments").doc(), { saleId: f.saleId, amount: 1, currency: "THB", receivedOn: date, status: "received" });
  await batch.commit();
  assert.equal((await summary(f.saleId)).cancellationSummary.netRetained, 60);
  await assert.rejects(cancelSale(db, f), /explicit cancellation disposition/);
  await cancelSale(db, { ...f, disposition: decision("full_refund") });
  assert.equal((await summary(f.saleId)).cancellationSummary.netRetained, 0);
});

test("planned/completed Handovers and terminal Sales block cancellation; cancelled Handover history is preserved", async () => {
  for (const status of ["planned", "completed", "cancelled"]) {
    const f = await fixture(); const ref = db.collection("handovers").doc(); await ref.set({ saleId: f.saleId, birdId: f.birdId, status });
    if (status === "cancelled") await cancelSale(db, f); else await assert.rejects(cancelSale(db, f), /non-cancelled handover/);
    assert.equal((await ref.get()).data()?.status, status);
  }
  const f = await fixture(); await db.collection("sales").doc(f.saleId).update({ status: "completed" });
  await assert.rejects(cancelSale(db, f), /draft or confirmed/);
});

test("concurrent cancellation/payment/refund finishes with cancelled Sale and fully reconciled money", async () => {
  for (const inherited of [false, true]) {
    const f = await fixture(inherited); const p = await pay(f, 1000);
    const results = await Promise.allSettled([
      cancelSale(db, { ...f, disposition: decision("full_refund") }),
      pay(f, 1000),
      refundPayment(db, { ...(inherited ? f.deposit! : p), ...decision("partial_refund", 100) }),
    ]);
    assert.equal(results[0].status, "fulfilled");
    assert.equal((await saleData(f.saleId)).status, "cancelled");
    assert.equal((await summary(f.saleId)).cancellationSummary.netRetained, 0);
    await assert.rejects(pay(f, 1), /Cancelled sale/);
  }
});

test("an earlier payment-level no_refund does not replace an explicit Sale cancellation decision", async () => {
  const f = await fixture(); const p = await pay(f, 1000);
  const earlier = await refundPayment(db, { ...p, ...decision("no_refund") });
  await assert.rejects(cancelSale(db, f), /explicit cancellation disposition/);
  await cancelSale(db, { ...f, disposition: { ...decision("no_refund"), reason: "New cancellation agreement" } });
  const sale = await saleData(f.saleId);
  assert.equal(sale.cancellationDisposition.reason, "New cancellation agreement");
  assert.deepEqual(sale.cancellationDisposition.refundIds, [earlier.refundId]);
});
