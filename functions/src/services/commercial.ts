import { FieldValue, Firestore, Transaction } from "firebase-admin/firestore";
import { fail } from "../domain/errors.js";
import { requireDate, requireId } from "../domain/validation.js";

const id = () => crypto.randomUUID();
const now = () => FieldValue.serverTimestamp();
const today = () => new Date().toISOString().slice(0, 10);
const ref = (db: Firestore, collection: string, value: string) => db.collection(collection).doc(value);
const openSaleStatuses = ["draft", "confirmed"];
const nonCancelled = (status: unknown) => status !== "cancelled";
const requirePositive = (value: unknown, name: string): number => {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) fail("invalid-argument", `${name} must be greater than zero.`);
  return value as number;
};
const hasOwn = (input: Record<string, unknown>, key: string) => Object.prototype.hasOwnProperty.call(input, key);
const agreementSnapshot = (input: Record<string, unknown>) => {
  const hasPrice = hasOwn(input, "agreedPrice");
  const hasCurrency = hasOwn(input, "currency");
  if (hasPrice !== hasCurrency) fail("invalid-argument", "agreedPrice and currency must be supplied together.");
  if (!hasPrice) return {};
  const agreedPrice = input.agreedPrice;
  if (typeof agreedPrice !== "number" || !Number.isFinite(agreedPrice) || agreedPrice <= 0) fail("invalid-argument", "agreedPrice must be a finite number greater than zero.");
  if (input.currency !== "THB") fail("invalid-argument", "Only THB is supported for agreement prices.");
  return { agreedPrice, currency: "THB" as const };
};
const timeline = (tx: Transaction, db: Firestore, saleId: string, eventType: string, payload: Record<string, unknown> = {}) => {
  tx.create(db.collection("saleTimeline").doc(id()), { saleId, eventType, occurredAt: now(), actorId: "function", payload });
};
const requireActiveCustomer = (data: Record<string, unknown> | undefined) => {
  if (data?.status !== "active") fail("failed-precondition", "Customer must be active for new commercial records.");
};
const requireAvailableBird = (data: Record<string, unknown> | undefined) => {
  if (["sold", "given_away", "deceased", "lost"].includes(String(data?.status))) fail("failed-precondition", "Bird is no longer available for a commercial workflow.");
};
const birdSaleSnapshots = (tx: Transaction, db: Firestore, birdId: string) => Promise.all([
  tx.get(db.collection("sales").where("birdId", "==", birdId).where("status", "in", openSaleStatuses)),
  tx.get(db.collection("sales").where("birdId", "==", birdId).where("status", "==", "completed")),
]);
const assertNoCompetingSale = (open: FirebaseFirestore.QuerySnapshot, completed: FirebaseFirestore.QuerySnapshot, exceptSaleId?: string) => {
  if (open.docs.some((doc) => doc.id !== exceptSaleId)) fail("failed-precondition", "Bird already has an open sale.");
  if (completed.docs.some((doc) => doc.id !== exceptSaleId)) fail("failed-precondition", "Bird already has a completed sale.");
};
const assertNoConflictingGiveaway = async (tx: Transaction, db: Firestore, birdId: string) => {
  const giveaways = await tx.get(db.collection("giveaways").where("birdId", "==", birdId).where("status", "in", ["planned", "completed"]));
  if (!giveaways.empty) fail("failed-precondition", "Bird already has a conflicting giveaway.");
};

export const createCustomer = async (db: Firestore, input: Record<string, unknown>) => {
  if (typeof input.displayName !== "string" || !input.displayName.trim()) fail("invalid-argument", "displayName is required.");
  const customerId = id();
  const displayName = (input.displayName as string).trim();
  await db.runTransaction(async (tx) => {
    tx.create(ref(db, "customers", customerId), {
      displayName,
      ...(typeof input.phone === "string" ? { phone: input.phone } : {}),
      ...(typeof input.email === "string" ? { email: input.email } : {}),
      ...(typeof input.address === "string" ? { address: input.address } : {}),
      status: "active", createdAt: now(), updatedAt: now(),
    });
  });
  return { customerId };
};

export const createReservation = async (db: Firestore, input: Record<string, unknown>) => {
  const birdId = requireId(input.birdId, "birdId"); const customerId = requireId(input.customerId, "customerId"); const reservedOn = requireDate(input.reservedOn, "reservedOn");
  const expiresOn = input.expiresOn === undefined ? undefined : requireDate(input.expiresOn, "expiresOn");
  const snapshot = agreementSnapshot(input);
  if (expiresOn && expiresOn < reservedOn) fail("invalid-argument", "expiresOn cannot precede reservedOn.");
  return db.runTransaction(async (tx) => {
    const [bird, customer, activeReservations, sales] = await Promise.all([tx.get(ref(db, "birds", birdId)), tx.get(ref(db, "customers", customerId)), tx.get(db.collection("reservations").where("birdId", "==", birdId).where("status", "==", "active")), birdSaleSnapshots(tx, db, birdId)]);
    if (!bird.exists) fail("not-found", "Bird not found."); if (!customer.exists) fail("not-found", "Customer not found.");
    requireActiveCustomer(customer.data()); requireAvailableBird(bird.data());
    await assertNoConflictingGiveaway(tx, db, birdId);
    const overdueReservations = activeReservations.docs.filter((reservation) => typeof reservation.data().expiresOn === "string" && reservation.data().expiresOn < today());
    const overdueSales = await Promise.all(overdueReservations.map((reservation) => tx.get(db.collection("sales").where("reservationId", "==", reservation.id))));
    const expirableIds = new Set(overdueReservations.filter((_, index) => !overdueSales[index].docs.some((sale) => nonCancelled(sale.data().status))).map((reservation) => reservation.id));
    for (const reservation of activeReservations.docs.filter((entry) => expirableIds.has(entry.id))) tx.update(reservation.ref, { status: "expired", updatedAt: now() });
    if (activeReservations.docs.some((reservation) => !expirableIds.has(reservation.id))) fail("failed-precondition", "Bird already has an active reservation.");
    assertNoCompetingSale(sales[0], sales[1]);
    const reservationId = id();
    tx.create(ref(db, "reservations", reservationId), { birdId, customerId, reservedOn, ...(expiresOn ? { expiresOn } : {}), ...snapshot, status: "active", createdAt: now(), updatedAt: now() });
    return { reservationId };
  });
};

const closeReservation = async (db: Firestore, input: Record<string, unknown>, status: "cancelled" | "expired") => {
  const reservationId = requireId(input.reservationId, "reservationId");
  const effectiveOn = status === "expired" ? requireDate(input.expiredOn, "expiredOn") : undefined;
  return db.runTransaction(async (tx) => {
    const reservationRef = ref(db, "reservations", reservationId); const reservation = await tx.get(reservationRef);
    if (!reservation.exists) fail("not-found", "Reservation not found.");
    const data = reservation.data()!;
    if (data.status !== "active") fail("failed-precondition", "Only an active reservation can be changed.");
    if (status === "expired" && (typeof data.expiresOn !== "string" || data.expiresOn > effectiveOn!)) fail("failed-precondition", "Reservation cannot be expired before its stored expiresOn date.");
    const linkedSales = await tx.get(db.collection("sales").where("reservationId", "==", reservationId));
    if (linkedSales.docs.some((sale) => nonCancelled(sale.data().status))) fail("failed-precondition", "Reservation already has a non-cancelled sale.");
    tx.update(reservationRef, { status, ...(status === "cancelled" && typeof input.cancelReason === "string" && input.cancelReason.trim() ? { cancelReason: input.cancelReason.trim() } : {}), updatedAt: now() });
    return { reservationId, status };
  });
};
export const cancelReservation = (db: Firestore, input: Record<string, unknown>) => closeReservation(db, input, "cancelled");
export const expireReservation = (db: Firestore, input: Record<string, unknown>) => closeReservation(db, input, "expired");

export const recordPayment = async (db: Firestore, input: Record<string, unknown>) => {
  const reservationId = input.reservationId === undefined ? undefined : requireId(input.reservationId, "reservationId"); const saleId = input.saleId === undefined ? undefined : requireId(input.saleId, "saleId");
  if ((reservationId ? 1 : 0) + (saleId ? 1 : 0) !== 1) fail("invalid-argument", "Payment requires exactly one of reservationId or saleId.");
  const amount = requirePositive(input.amount, "amount"); const currency = requireId(input.currency, "currency"); const receivedOn = requireDate(input.receivedOn, "receivedOn"); const paymentMethod = requireId(input.paymentMethod, "paymentMethod");
  return db.runTransaction(async (tx) => {
    const owner = await tx.get(ref(db, reservationId ? "reservations" : "sales", reservationId ?? saleId!)); if (!owner.exists) fail("not-found", "Payment owner not found.");
    const ownerData = owner.data() as Record<string, unknown>;
    if (reservationId) {
      if (ownerData.status !== "active" || (typeof ownerData.expiresOn === "string" && ownerData.expiresOn < today())) fail("failed-precondition", "Reservation is expired or inactive.");
      const linkedSales = await tx.get(db.collection("sales").where("reservationId", "==", reservationId));
      if (linkedSales.docs.some((sale) => nonCancelled(sale.data().status))) fail("failed-precondition", "Reservation already has a non-cancelled sale; record further payments on the sale.");
    }
    const linkedReservationId = saleId && typeof ownerData.reservationId === "string" ? ownerData.reservationId : undefined;
    const paymentQueries = await Promise.all([
      tx.get(db.collection("payments").where(reservationId ? "reservationId" : "saleId", "==", reservationId ?? saleId!)),
      linkedReservationId ? tx.get(db.collection("payments").where("reservationId", "==", linkedReservationId)) : Promise.resolve(undefined),
    ]);
    const applicablePayments = [...paymentQueries[0].docs, ...(paymentQueries[1]?.docs ?? [])].filter((payment) => payment.data().status === "received");
    const refundQueries = await Promise.all(applicablePayments.map((payment) => tx.get(db.collection("refunds").where("paymentId", "==", payment.id))));
    const totalReceived = applicablePayments.reduce((sum, payment) => sum + Number(payment.data().amount ?? 0), 0);
    const totalRefunded = refundQueries.flatMap((refunds) => refunds.docs).reduce((sum, refund) => sum + Number(refund.data().amount ?? 0), 0);
    const agreedPrice = ownerData.agreedPrice;
    if (typeof agreedPrice === "number" && Number.isFinite(agreedPrice) && amount > agreedPrice - (totalReceived - totalRefunded)) fail("failed-precondition", "Payment amount exceeds the remaining agreement balance.");
    const paymentId = id(); tx.create(ref(db, "payments", paymentId), { ...(reservationId ? { reservationId, purpose: "deposit" } : { saleId, purpose: "sale_payment" }), amount, currency, receivedOn, paymentMethod, status: "received", createdAt: now(), updatedAt: now() });
    if (saleId) timeline(tx, db, saleId, "payment_recorded", { paymentId, amount }); return { paymentId };
  });
};

export const refundPayment = async (db: Firestore, input: Record<string, unknown>) => {
  const paymentId = requireId(input.paymentId, "paymentId"); const outcome = requireId(input.outcome, "outcome"); if (!["full_refund", "partial_refund", "no_refund"].includes(outcome)) fail("invalid-argument", "Invalid refund outcome.");
  const reason = requireId(input.reason, "reason"); const refundedOn = requireDate(input.refundedOn, "refundedOn");
  return db.runTransaction(async (tx) => {
    const payment = await tx.get(ref(db, "payments", paymentId)); if (!payment.exists) fail("not-found", "Payment not found.");
    const prior = await tx.get(db.collection("refunds").where("paymentId", "==", paymentId));
    if (outcome === "no_refund" && prior.docs.some((doc) => doc.data().outcome === "no_refund")) fail("failed-precondition", "Payment already has a no_refund decision.");
    const paid = Number(payment.data()?.amount); const refunded = prior.docs.reduce((sum, doc) => sum + Number(doc.data().amount ?? 0), 0); const remaining = paid - refunded;
    let amount: number;
    if (outcome === "full_refund") { if (remaining <= 0) fail("failed-precondition", "Nothing remains refundable."); amount = remaining; }
    else if (outcome === "partial_refund") { amount = requirePositive(input.amount, "amount"); if (amount >= remaining) fail("failed-precondition", "Partial refund must be less than the remaining refundable balance."); }
    else amount = 0;
    const refundId = id(); tx.create(ref(db, "refunds", refundId), { paymentId, amount, refundedOn, outcome, reason, ...(typeof input.notes === "string" ? { notes: input.notes } : {}), createdAt: now(), updatedAt: now() });
    const saleId = payment.data()?.saleId; if (typeof saleId === "string") timeline(tx, db, saleId, "refund_decision_recorded", { refundId, paymentId, amount, outcome }); return { refundId, amount };
  });
};

export const createSale = async (db: Firestore, input: Record<string, unknown>) => {
  const birdId = requireId(input.birdId, "birdId"); const customerId = requireId(input.customerId, "customerId"); const createdOn = requireDate(input.createdOn, "createdOn"); const reservationId = input.reservationId === undefined ? undefined : requireId(input.reservationId, "reservationId");
  const suppliedSnapshot = agreementSnapshot(input);
  const hasSuppliedSnapshot = hasOwn(suppliedSnapshot, "agreedPrice");
  return db.runTransaction(async (tx) => {
    const [bird, customer, reservation, sales, reservationSales, reservationPayments] = await Promise.all([tx.get(ref(db, "birds", birdId)), tx.get(ref(db, "customers", customerId)), reservationId ? tx.get(ref(db, "reservations", reservationId)) : Promise.resolve(undefined), birdSaleSnapshots(tx, db, birdId), reservationId ? tx.get(db.collection("sales").where("reservationId", "==", reservationId)) : Promise.resolve(undefined), reservationId ? tx.get(db.collection("payments").where("reservationId", "==", reservationId)) : Promise.resolve(undefined)]);
    if (!bird.exists || !customer.exists) fail("not-found", "Bird or customer not found."); requireActiveCustomer(customer.data()); requireAvailableBird(bird.data()); await assertNoConflictingGiveaway(tx, db, birdId); assertNoCompetingSale(sales[0], sales[1]);
    let snapshot = suppliedSnapshot;
    if (reservationId) { const reservationData = reservation?.data(); if (!reservation?.exists || reservationData?.status !== "active" || (typeof reservationData.expiresOn === "string" && reservationData.expiresOn < today())) fail("failed-precondition", "Reservation is expired or inactive."); const activeReservation = reservationData as Record<string, unknown>; if (activeReservation.birdId !== birdId || activeReservation.customerId !== customerId) fail("failed-precondition", "Reservation does not match sale bird and customer."); if (reservationSales?.docs.some((sale) => nonCancelled(sale.data().status))) fail("failed-precondition", "Reservation already has a non-cancelled sale."); const reservationSnapshot = agreementSnapshot(activeReservation); if (hasOwn(reservationSnapshot, "agreedPrice")) { if (hasSuppliedSnapshot) fail("invalid-argument", "Reservation agreement price cannot be overwritten during conversion."); snapshot = reservationSnapshot; } const receivedPayments = reservationPayments?.docs.filter((payment) => payment.data().status === "received") ?? []; const refundQueries = await Promise.all(receivedPayments.map((payment) => tx.get(db.collection("refunds").where("paymentId", "==", payment.id)))); const paid = receivedPayments.reduce((sum, payment) => sum + Number(payment.data().amount ?? 0), 0) - refundQueries.flatMap((refunds) => refunds.docs).reduce((sum, refund) => sum + Number(refund.data().amount ?? 0), 0); if (typeof snapshot.agreedPrice === "number" && paid > snapshot.agreedPrice) fail("failed-precondition", "Reservation payments exceed the Sale agreement price."); }
    const saleId = id(); tx.create(ref(db, "sales", saleId), { birdId, customerId, createdOn, ...(reservationId ? { reservationId } : {}), ...snapshot, status: reservationId ? "confirmed" : "draft", createdAt: now(), updatedAt: now() });
    if (reservationId && typeof snapshot.agreedPrice === "number" && snapshot.currency === "THB") tx.create(ref(db, "priceHistory", `sale-${saleId}`), { birdId, amount: snapshot.agreedPrice, currency: snapshot.currency, effectiveOn: createdOn, kind: "final", sourceType: "sale", saleId, createdAt: now() });
    timeline(tx, db, saleId, "sale_created", { reservationId: reservationId ?? null }); return { saleId };
  });
};

export const createPriceHistory = async (db: Firestore, input: Record<string, unknown>) => {
  const birdId = requireId(input.birdId, "birdId");
  const amount = input.amount;
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0) fail("invalid-argument", "amount must be a finite number greater than or equal to zero.");
  if (input.currency !== "THB") fail("invalid-argument", "Only THB is supported for Price History.");
  const effectiveOn = requireDate(input.effectiveOn, "effectiveOn");
  if (input.kind !== "list" && input.kind !== "offer") fail("invalid-argument", "Manual Price History kind must be list or offer.");
  const validUntil = input.validUntil === undefined ? undefined : requireDate(input.validUntil, "validUntil");
  if (validUntil && validUntil < effectiveOn) fail("invalid-argument", "validUntil cannot precede effectiveOn.");
  return db.runTransaction(async (tx) => {
    const bird = await tx.get(ref(db, "birds", birdId));
    if (!bird.exists) fail("not-found", "Bird not found.");
    const priceHistoryId = id();
    tx.create(ref(db, "priceHistory", priceHistoryId), { birdId, amount, currency: "THB", effectiveOn, kind: input.kind, ...(validUntil ? { validUntil } : {}), ...(typeof input.notes === "string" && input.notes.trim() ? { notes: input.notes.trim() } : {}), createdAt: now() });
    return { priceHistoryId };
  });
};

export const confirmSale = async (db: Firestore, input: Record<string, unknown>) => {
  const saleId = requireId(input.saleId, "saleId");
  return db.runTransaction(async (tx) => {
    const saleRef = ref(db, "sales", saleId); const sale = await tx.get(saleRef); if (!sale.exists) fail("not-found", "Sale not found."); const data = sale.data()!;
    if (data.status !== "draft") fail("failed-precondition", "Only a draft sale can be confirmed."); const birdId = requireId(data.birdId, "sale.birdId");
    const [bird, customer, reservation, sales] = await Promise.all([tx.get(ref(db, "birds", birdId)), tx.get(ref(db, "customers", requireId(data.customerId, "sale.customerId"))), typeof data.reservationId === "string" ? tx.get(ref(db, "reservations", data.reservationId)) : Promise.resolve(undefined), birdSaleSnapshots(tx, db, birdId)]);
    if (!bird.exists || !customer.exists) fail("not-found", "Bird or customer not found."); requireAvailableBird(bird.data()); requireActiveCustomer(customer.data()); await assertNoConflictingGiveaway(tx, db, birdId); assertNoCompetingSale(sales[0], sales[1], saleId);
    if (data.reservationId && (!reservation?.exists || reservation.data()?.status !== "active")) fail("failed-precondition", "Linked reservation must remain active.");
    if (typeof data.agreedPrice === "number" && data.currency === "THB") tx.create(ref(db, "priceHistory", `sale-${saleId}`), { birdId, amount: data.agreedPrice, currency: data.currency, effectiveOn: requireDate(data.createdOn, "sale.createdOn"), kind: "final", sourceType: "sale", saleId, createdAt: now() });
    tx.update(saleRef, { status: "confirmed", updatedAt: now() }); return { saleId, status: "confirmed" };
  });
};

export const completeSale = async (db: Firestore, input: Record<string, unknown>) => {
  const saleId = requireId(input.saleId, "saleId"); const completedOn = requireDate(input.completedOn, "completedOn");
  return db.runTransaction(async (tx) => {
    const saleRef = ref(db, "sales", saleId); const sale = await tx.get(saleRef); if (!sale.exists) fail("not-found", "Sale not found."); const data = sale.data()!;
    if (data.status !== "confirmed") fail("failed-precondition", "Only a confirmed sale can be completed."); const birdId = requireId(data.birdId, "sale.birdId"); const reservationId = typeof data.reservationId === "string" ? data.reservationId : undefined;
    const [bird, completed, reservation] = await Promise.all([tx.get(ref(db, "birds", birdId)), tx.get(db.collection("sales").where("birdId", "==", birdId).where("status", "==", "completed")), reservationId ? tx.get(ref(db, "reservations", reservationId)) : Promise.resolve(undefined)]);
    if (!bird.exists) fail("not-found", "Bird not found."); requireAvailableBird(bird.data()); await assertNoConflictingGiveaway(tx, db, birdId); if (!completed.empty) fail("failed-precondition", "Bird already has a completed sale."); if (reservationId && (!reservation?.exists || reservation.data()?.status !== "active")) fail("failed-precondition", "Linked reservation must remain active.");
    tx.update(saleRef, { status: "completed", completedOn, updatedAt: now() }); if (reservationId) tx.update(ref(db, "reservations", reservationId), { status: "completed", updatedAt: now() }); timeline(tx, db, saleId, "sale_completed", { birdId, completedOn }); return { saleId, status: "completed" };
  });
};

export const cancelSale = async (db: Firestore, input: Record<string, unknown>) => {
  const saleId = requireId(input.saleId, "saleId");
  return db.runTransaction(async (tx) => {
    const saleRef = ref(db, "sales", saleId); const sale = await tx.get(saleRef); if (!sale.exists) fail("not-found", "Sale not found."); if (!openSaleStatuses.includes(String(sale.data()?.status))) fail("failed-precondition", "Only a draft or confirmed sale can be cancelled.");
    const handovers = await tx.get(db.collection("handovers").where("saleId", "==", saleId).where("status", "==", "completed")); if (!handovers.empty) fail("failed-precondition", "Sale with a completed handover cannot be cancelled.");
    tx.update(saleRef, { status: "cancelled", ...(typeof input.cancelReason === "string" && input.cancelReason.trim() ? { cancelReason: input.cancelReason.trim() } : {}), updatedAt: now() }); return { saleId, status: "cancelled" };
  });
};
