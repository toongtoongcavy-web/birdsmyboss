import { Firestore } from "firebase-admin/firestore";
import { fail } from "../domain/errors.js";
import { requireId } from "../domain/validation.js";

const limitOf = (value: unknown) => typeof value === "number" && Number.isInteger(value) && value > 0 ? Math.min(value, 50) : 25;
const list = async (db: Firestore, collection: string, input: Record<string, unknown>, map: (id: string, data: Record<string, unknown>) => Record<string, unknown>) =>
  (await db.collection(collection).limit(limitOf(input.limit)).get()).docs.map((doc) => map(doc.id, doc.data()));
const bird = (id: string, d: Record<string, unknown>) => ({ birdId: id, ringId: d.ringId, displayName: d.displayName, mutation: d.mutation ?? null, origin: d.origin, status: d.status, hatchedOn: d.hatchedOn ?? null, eggId: d.eggId ?? null, passportStatus: d.passportStatus ?? "draft" });
const customer = (id: string, d: Record<string, unknown>) => ({ customerId: id, displayName: d.displayName, phone: d.phone ?? null, email: d.email ?? null, status: d.status });
const priceSnapshot = (d: Record<string, unknown>) => typeof d.agreedPrice === "number" && d.currency === "THB" ? { agreedPrice: d.agreedPrice, currency: "THB" } : {};
const sale = (id: string, d: Record<string, unknown>) => ({ saleId: id, birdId: d.birdId, customerId: d.customerId, reservationId: d.reservationId ?? null, ...priceSnapshot(d), status: d.status, createdOn: d.createdOn, completedOn: d.completedOn ?? null });
const timestampValue = (value: unknown) => value && typeof (value as { toMillis?: unknown }).toMillis === "function" ? (value as { toMillis: () => number }).toMillis() : new Date(String(value ?? 0)).getTime();
const timelineDate = (value: unknown) => value && typeof (value as { toDate?: unknown }).toDate === "function"
  ? (value as { toDate: () => Date }).toDate().toISOString().slice(0, 10)
  : typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : null;
const currentSex = async (db: Firestore, birdId: unknown) => {
  if (typeof birdId !== "string") return "unknown";
  const sex = await db.collection("sexHistory").where("birdId", "==", birdId).get();
  return sex.docs.map(doc => doc.data()).filter(entry => entry.sex !== "unknown")
    .sort((a, b) => String(b.determinedOn ?? "").localeCompare(String(a.determinedOn ?? "")))[0]?.sex ?? "unknown";
};
const birdIdentity = async (db: Firestore, birdId: unknown, role?: unknown) => {
  if (typeof birdId !== "string") return null;
  const snapshot = await db.collection("birds").doc(birdId).get();
  if (!snapshot.exists) return null;
  const data = snapshot.data()!;
  return { birdId, role, displayName: data.displayName ?? null, ringId: data.ringId, sex: await currentSex(db, birdId) };
};
const pairMembers = async (db: Firestore, pairId: string) => {
  const members = await db.collection("pairMembers").where("pairId", "==", pairId).limit(20).get();
  const identities = await Promise.all(members.docs.map(member => birdIdentity(db, member.data().birdId, member.data().role)));
  return identities.filter(identity => identity !== null);
};

export const listBirds = async (db: Firestore, input: Record<string, unknown>) => {
  const birds = await list(db, "birds", input, bird);
  return Promise.all(birds.map(async (item) => {
    return { ...item, currentSex: await currentSex(db, item.birdId) };
  }));
};
export const getBirdDetails = async (db: Firestore, input: Record<string, unknown>) => {
  const birdId = requireId(input.birdId, "birdId"); const snapshot = await db.collection("birds").doc(birdId).get(); if (!snapshot.exists) fail("not-found", "Bird not found.");
  const d = snapshot.data()!; const [sex, weights, photos, documents] = await Promise.all([
    db.collection("sexHistory").where("birdId", "==", birdId).limit(20).get(), db.collection("weightHistory").where("birdId", "==", birdId).limit(20).get(),
    db.collection("photos").where("ownerType", "==", "BIRD").where("ownerId", "==", birdId).limit(20).get(), db.collection("documents").where("ownerType", "==", "BIRD").where("ownerId", "==", birdId).limit(20).get()
  ]);
  let parentage: { male: { birdId: string; ringId: unknown; displayName: unknown } | null; female: { birdId: string; ringId: unknown; displayName: unknown } | null } | null = null;
  if (typeof d.eggId === "string") { const egg = await db.collection("eggs").doc(d.eggId).get(); const cycleId = egg.data()?.cycleId; if (egg.exists && typeof cycleId === "string") { const cycle = await db.collection("breedingCycles").doc(cycleId).get(); const pairId = cycle.data()?.pairId; if (cycle.exists && typeof pairId === "string") { const members = await db.collection("pairMembers").where("pairId", "==", pairId).limit(2).get(); const parent = async (role: string) => { const member = members.docs.find(x => x.data().role === role); if (!member) return null; const b = await db.collection("birds").doc(member.data().birdId).get(); return b.exists ? { birdId: b.id, ringId: b.data()!.ringId, displayName: b.data()!.displayName ?? null } : null; }; parentage = { male: await parent("male"), female: await parent("female") }; } } }
  return { ...bird(birdId, d), publicToken: d.publicToken ?? null, parentage, sexHistory: sex.docs.map(x => ({ sex: x.data().sex, method: x.data().method, determinedOn: x.data().determinedOn })), weightHistory: weights.docs.map(x => ({ weightGrams: x.data().weightGrams, measuredOn: x.data().measuredOn })), photos: photos.docs.map(x => ({ photoId: x.id, caption: x.data().caption ?? null, status: x.data().status, isPublicOnPassport: x.data().isPublicOnPassport === true })), documents: documents.docs.map(x => ({ documentId: x.id, documentType: x.data().documentType, issuedOn: x.data().issuedOn ?? null, status: x.data().status, isPublicOnPassport: x.data().isPublicOnPassport === true, supersededByDocumentId: x.data().supersededByDocumentId ?? null })) };
};
export const listCages = (db: Firestore, input: Record<string, unknown>) => list(db, "cages", input, (cageId, d) => ({ cageId, code: d.code ?? d.name ?? cageId, name: d.name ?? null, status: d.status ?? "active" }));
export const listPairs = async (db: Firestore, input: Record<string, unknown>) => {
  const pairs = await list(db, "pairs", input, (pairId, d) => ({ pairId, status: d.status, startedOn: d.startedOn ?? null, endedOn: d.endedOn ?? null }));
  return Promise.all(pairs.map(async pair => ({ pairId: String(pair.pairId), status: pair.status, startedOn: pair.startedOn, endedOn: pair.endedOn, members: await pairMembers(db, String(pair.pairId)) })));
};
export const getPairDetails = async (db: Firestore, input: Record<string, unknown>) => {
  const pairId = requireId(input.pairId, "pairId"); const pair = await db.collection("pairs").doc(pairId).get(); if (!pair.exists) fail("not-found", "Pair not found.");
  const [members, assignments, cycles] = await Promise.all([pairMembers(db, pairId), db.collection("cageAssignments").where("pairId", "==", pairId).limit(20).get(), db.collection("breedingCycles").where("pairId", "==", pairId).get()]);
  const assignmentDtos = await Promise.all(assignments.docs.map(async assignment => { const data = assignment.data(); const cage = await db.collection("cages").doc(data.cageId).get(); return { cageAssignmentId: assignment.id, cageId: data.cageId, code: cage.data()?.code ?? null, name: cage.data()?.name ?? null, status: cage.data()?.status ?? null, startsOn: data.startsOn, endsOn: data.endsOn ?? null }; }));
  const cycleDtos = await Promise.all(cycles.docs.map(async cycle => {
    const data = cycle.data();
    const eggs = await db.collection("eggs").where("cycleId", "==", cycle.id).get();
    return { breedingCycleId: cycle.id, code: data.code ?? null, startedOn: data.startedOn, endedOn: data.endedOn ?? null, status: data.status, eggs: eggs.docs.map(egg => ({ eggId: egg.id, sequenceNo: egg.data().sequenceNo, laidOn: egg.data().laidOn, status: egg.data().status })) };
  }));
  return { pairId, status: pair.data()!.status, startedOn: pair.data()!.startedOn ?? null, endedOn: pair.data()!.endedOn ?? null, members, assignments: assignmentDtos, cycles: cycleDtos };
};
export const listBreedingCycles = (db: Firestore, input: Record<string, unknown>) => list(db, "breedingCycles", input, (breedingCycleId, d) => ({ breedingCycleId, pairId: d.pairId, code: d.code ?? null, startedOn: d.startedOn, status: d.status }));
export const listEggs = (db: Firestore, input: Record<string, unknown>) => list(db, "eggs", input, (eggId, d) => ({ eggId, cycleId: d.cycleId, sequenceNo: d.sequenceNo, laidOn: d.laidOn ?? null, expectedHatchOn: d.expectedHatchOn ?? null, status: d.status }));
export const listCustomers = (db: Firestore, input: Record<string, unknown>) => list(db, "customers", input, customer);
export const getCustomerDetails = async (db: Firestore, input: Record<string, unknown>) => { const customerId = requireId(input.customerId, "customerId"); const c = await db.collection("customers").doc(customerId).get(); if (!c.exists) fail("not-found", "Customer not found."); const [reservations, sales] = await Promise.all([db.collection("reservations").where("customerId", "==", customerId).limit(25).get(), db.collection("sales").where("customerId", "==", customerId).limit(25).get()]); return { ...customer(customerId, c.data()!), reservations: reservations.docs.map(x => ({ reservationId: x.id, birdId: x.data().birdId, status: x.data().status, reservedOn: x.data().reservedOn })), sales: sales.docs.map(x => sale(x.id, x.data())) }; };
export const listReservations = (db: Firestore, input: Record<string, unknown>) => list(db, "reservations", input, (reservationId, d) => ({ reservationId, birdId: d.birdId, customerId: d.customerId, reservedOn: d.reservedOn, expiresOn: d.expiresOn ?? null, ...priceSnapshot(d), status: d.status }));
export const listSales = (db: Firestore, input: Record<string, unknown>) => list(db, "sales", input, sale);
export const listBirdPriceHistory = async (db: Firestore, input: Record<string, unknown>) => {
  const birdId = requireId(input.birdId, "birdId");
  const records = await db.collection("priceHistory").where("birdId", "==", birdId).limit(50).get();
  return records.docs.map(doc => ({ priceHistoryId: doc.id, amount: doc.data().amount, currency: doc.data().currency, effectiveOn: doc.data().effectiveOn, kind: doc.data().kind, validUntil: doc.data().validUntil ?? null, notes: doc.data().notes ?? null }))
    .sort((a, b) => String(b.effectiveOn).localeCompare(String(a.effectiveOn)) || String(b.priceHistoryId).localeCompare(String(a.priceHistoryId)));
};
export const listSaleTimeline = async (db: Firestore, input: Record<string, unknown>) => {
  const saleId = requireId(input.saleId, "saleId");
  const [saleDoc, events] = await Promise.all([db.collection("sales").doc(saleId).get(), db.collection("saleTimeline").where("saleId", "==", saleId).limit(50).get()]);
  if (!saleDoc.exists) fail("not-found", "Sale not found.");
  return events.docs.map(doc => ({ saleTimelineId: doc.id, eventType: doc.data().eventType, occurredAt: doc.data().occurredAt ?? null }))
    .sort((a, b) => timestampValue(a.occurredAt) - timestampValue(b.occurredAt) || String(a.saleTimelineId).localeCompare(String(b.saleTimelineId)))
    .map(event => ({ ...event, occurredAt: timelineDate(event.occurredAt) }));
};
export const listPayments = (db: Firestore, input: Record<string, unknown>) => list(db, "payments", input, (paymentId, d) => ({ paymentId, reservationId: d.reservationId ?? null, saleId: d.saleId ?? null, amount: d.amount, currency: d.currency, receivedOn: d.receivedOn, paymentMethod: d.paymentMethod, status: d.status }));
export const listRefunds = (db: Firestore, input: Record<string, unknown>) => list(db, "refunds", input, (refundId, d) => ({ refundId, paymentId: d.paymentId, amount: d.amount, outcome: d.outcome, refundedOn: d.refundedOn, reason: d.reason }));
export const listGiveaways = async (db: Firestore, input: Record<string, unknown>) => {
  const giveaways = await list(db, "giveaways", input, (giveawayId, d) => ({ giveawayId, birdId: d.birdId, customerId: d.customerId ?? null, recipientName: d.recipientName, givenOn: d.givenOn, status: d.status, handoverId: d.handoverId ?? null }));
  return Promise.all(giveaways.map(async (giveaway) => ({ ...giveaway, bird: await birdIdentity(db, giveaway.birdId), customer: giveaway.customerId ? await db.collection("customers").doc(String(giveaway.customerId)).get().then(snapshot => snapshot.exists ? { customerId: snapshot.id, displayName: snapshot.data()!.displayName ?? null, status: snapshot.data()!.status ?? "active" } : null) : null })));
};
export const getGiveawayDetails = async (db: Firestore, input: Record<string, unknown>) => {
  const giveawayId = requireId(input.giveawayId, "giveawayId");
  const giveaway = await db.collection("giveaways").doc(giveawayId).get();
  if (!giveaway.exists) fail("not-found", "Giveaway not found.");
  const data = giveaway.data()!;
  const birdId = requireId(data.birdId, "giveaway.birdId");
  const [birdDto, customerSnapshot, handovers] = await Promise.all([
    birdIdentity(db, birdId),
    typeof data.customerId === "string" ? db.collection("customers").doc(data.customerId).get() : Promise.resolve(undefined),
    db.collection("handovers").where("giveawayId", "==", giveawayId).where("status", "==", "completed").limit(1).get(),
  ]);
  const handover = handovers.docs[0];
  return { giveawayId, birdId, recipientName: data.recipientName, givenOn: data.givenOn, status: data.status, notes: data.notes ?? null, bird: birdDto, customer: customerSnapshot?.exists ? { customerId: customerSnapshot.id, displayName: customerSnapshot.data()!.displayName ?? null, status: customerSnapshot.data()!.status ?? "active" } : null, handover: handover ? { handoverId: handover.id, handoverOn: handover.data().handoverOn, status: handover.data().status, recipientSnapshot: handover.data().recipientSnapshot } : null };
};
export const listDeliveries = (db: Firestore, input: Record<string, unknown>) => list(db, "deliveries", input, (deliveryId, d) => ({ deliveryId, saleId: d.saleId, distanceKm: d.distanceKm, freeDistanceKm: d.freeDistanceKm, pricePerKm: d.pricePerKm, shippingFee: d.shippingFee, currency: d.currency, status: d.status, createdOn: d.createdOn, deliveredOn: d.deliveredOn ?? null }));
export const listHandovers = (db: Firestore, input: Record<string, unknown>) => list(db, "handovers", input, (handoverId, d) => ({ handoverId, birdId: d.birdId, saleId: d.saleId ?? null, giveawayId: d.giveawayId ?? null, handoverOn: d.handoverOn, sourceType: d.sourceType, recipientSnapshot: d.recipientSnapshot, status: d.status }));
export const listEligibleCompletedSales = async (db: Firestore, input: Record<string, unknown>) => (await db.collection("sales").where("status", "==", "completed").limit(limitOf(input.limit)).get()).docs.map(x => sale(x.id, x.data()));
export const getDashboardSummary = async (db: Firestore) => { const count = async (collection: string, status?: string) => (await (status ? db.collection(collection).where("status", "==", status) : db.collection(collection)).count().get()).data().count; const [birds, pairs, eggs, reservations, deliveries] = await Promise.all([count("birds"), count("pairs", "active"), count("eggs", "active"), count("reservations", "active"), count("deliveries", "planned")]); return { birds, activePairs: pairs, activeEggs: eggs, activeReservations: reservations, pendingDeliveries: deliveries }; };
