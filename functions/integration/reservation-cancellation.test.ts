import assert from "node:assert/strict";
import test from "node:test";
import { Firestore, Timestamp } from "firebase-admin/firestore";
import { cancelReservation, createCustomer, createReservation, createSale, recordPayment, refundPayment } from "../src/services/commercial.js";
import { listPayments, listRefunds } from "../src/services/reads.js";

const db = new Firestore({ projectId: "demo-commercial-cancellation" });
const date = "2026-10-30";
async function fixture() {
  const birdId = crypto.randomUUID();
  await db.collection("birds").doc(birdId).set({ status: "active", origin: "external" });
  const { customerId } = await createCustomer(db, { displayName: "Cancellation test" });
  const { reservationId } = await createReservation(db, { birdId, customerId, reservedOn: date, agreedPrice: 300, currency: "THB" });
  const pay = (amount: number) => recordPayment(db, { reservationId, amount, currency: "THB", receivedOn: date, paymentMethod: "cash" });
  return { reservationId, birdId, customerId, pay };
}
const disposition = (outcome: string, amount?: number) => ({ outcome, reason: "Operator cancellation decision", refundedOn: date, ...(amount === undefined ? {} : { amount }) });
const status = async (reservationId: string) => (await db.collection("reservations").doc(reservationId).get()).data()!;

test("unpaid and fully refunded reservations cancel; retained money cannot bypass disposition", async () => {
  const empty = await fixture();
  await cancelReservation(db, empty);
  assert.equal((await status(empty.reservationId)).status, "cancelled");
  const paid = await fixture();
  const payment = await paid.pay(100);
  await assert.rejects(cancelReservation(db, paid), /explicit cancellation disposition/);
  for (const invalid of [{ outcome: "full_refund" }, disposition("partial_refund", 100), disposition("partial_refund", -1), { ...disposition("no_refund"), refundedOn: "invalid" }]) {
    await assert.rejects(cancelReservation(db, { ...paid, disposition: invalid }));
    assert.equal((await status(paid.reservationId)).status, "active");
  }
  assert.equal((await db.collection("refunds").where("paymentId", "==", payment.paymentId).get()).size, 0);
  await refundPayment(db, { ...payment, ...disposition("full_refund") });
  await cancelReservation(db, paid);
  assert.equal((await status(paid.reservationId)).status, "cancelled");
});

for (const [outcome, amount] of [["full_refund", 300], ["partial_refund", 220], ["no_refund", 0]] as const) {
  test(`${outcome} cancellation atomically records canonical dispositions across payments`, async () => {
    const f = await fixture();
    const first = await f.pay(196), second = await f.pay(104);
    await cancelReservation(db, { reservationId: f.reservationId, disposition: disposition(outcome, outcome === "partial_refund" ? amount : undefined) });
    const reservation = await status(f.reservationId);
    assert.equal(reservation.status, "cancelled");
    assert.equal(reservation.cancellationDisposition.outcome, outcome);
    const refunds = (await Promise.all([first, second].map(p => db.collection("refunds").where("paymentId", "==", p.paymentId).get()))).flatMap(s => s.docs.map(d => d.data()));
    assert.equal(refunds.reduce((sum, r) => sum + r.amount, 0), amount);
    assert.equal(refunds.length, 2);
    assert.ok(refunds.every(r => r.reason && r.refundedOn === date));
    if (!amount) assert.ok(refunds.every(r => r.outcome === "no_refund"));
    await assert.rejects(f.pay(1), /inactive/);
    await assert.rejects(cancelReservation(db, { reservationId: f.reservationId, disposition: disposition(outcome, amount) }), /active/);
  });
}

test("conversion remains confirmed with inherited price; linked reservation cannot cancel", async () => {
  const f = await fixture(); await f.pay(100);
  const sale = await createSale(db, { ...f, createdOn: date });
  const data = (await db.collection("sales").doc(sale.saleId).get()).data()!;
  assert.equal(data.status, "confirmed"); assert.equal(data.agreedPrice, 300);
  await assert.rejects(cancelReservation(db, { ...f, disposition: disposition("full_refund") }), /non-cancelled sale/);
  assert.equal((await status(f.reservationId)).status, "active");
});

test("same-day payments retain 100/196/104 creation order after refund; totals are 400/100/300", async () => {
  const f = await fixture();
  const a = await f.pay(100), b = await f.pay(196);
  await refundPayment(db, { ...a, ...disposition("full_refund") });
  const c = await f.pay(104);
  const rows = (await listPayments(db, { limit: 50 })).filter(p => p.reservationId === f.reservationId);
  assert.deepEqual(rows.map(p => p.paymentId), [a.paymentId, b.paymentId, c.paymentId]);
  assert.deepEqual(rows.map(p => p.amount), [100, 196, 104]);
  assert.ok(rows.every(p => !("createdAt" in p)));
  const refunds = (await listRefunds(db, { limit: 50 })).filter(r => rows.some(p => p.paymentId === r.paymentId));
  const gross = rows.reduce((sum, p) => sum + Number(p.amount), 0), refunded = refunds.reduce((sum, r) => sum + Number(r.amount), 0);
  assert.deepEqual([gross, refunded, gross - refunded], [400, 100, 300]);
  await assert.rejects(cancelReservation(db, f), /explicit cancellation disposition/);
});

test("refund ordering uses date, nanosecond creation time, ID and deterministic legacy fallback before limiting", async () => {
  const records = [
    // Firestore persists microsecond precision, unlike in-memory Timestamp.
    ["order-z", "0001-01-01", new Timestamp(1, 1000)],
    ["order-a", "0001-01-01", new Timestamp(1, 2000)],
    ["order-b", "0001-01-01", new Timestamp(1, 2000)],
    ["order-legacy-b", "0001-01-01", null],
    ["order-legacy-a", "0001-01-01", null],
    ["order-earlier", "0001-01-02", new Timestamp(0, 0)],
  ] as const;
  for (const [id, refundedOn, createdAt] of records) await db.collection("refunds").doc(id).set({ refundedOn, paymentId: "ordering", amount: 0, outcome: "no_refund", reason: "test", ...(createdAt ? { createdAt } : {}) });
  const rows = await listRefunds(db, { limit: 6 });
  assert.deepEqual(rows.map(r => r.refundId), ["order-z", "order-a", "order-b", "order-legacy-a", "order-legacy-b", "order-earlier"]);
  assert.ok(rows.every(r => !("createdAt" in r)));
});

test("concurrent cancellation and refund cannot over-refund", async () => {
  const f = await fixture(); const p = await f.pay(100);
  await Promise.allSettled([
    cancelReservation(db, { ...f, disposition: disposition("full_refund") }),
    refundPayment(db, { ...p, ...disposition("full_refund") }),
  ]);
  const refunds = await db.collection("refunds").where("paymentId", "==", p.paymentId).get();
  assert.equal(refunds.docs.reduce((sum, d) => sum + d.data().amount, 0), 100);
  assert.equal((await status(f.reservationId)).status, "cancelled");
});
