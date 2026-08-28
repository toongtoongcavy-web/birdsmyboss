import { FieldValue, Firestore, Transaction } from "firebase-admin/firestore";
import { fail } from "../domain/errors.js";
import { classifyKinship, KinshipResult } from "../domain/kinship.js";
import { currentMembersAt, PairMember, validatePairMembers } from "../domain/pair.js";
import { assertNoCanonicalParentageInput, intervalsOverlap, normalizeRingId, requireDate, requireId } from "../domain/validation.js";

const collections = { birds: "birds", pairs: "pairs", pairMembers: "pairMembers", sexHistory: "sexHistory", cageAssignments: "cageAssignments", breedingCycles: "breedingCycles", eggs: "eggs" } as const;
const now = () => FieldValue.serverTimestamp();
const id = () => crypto.randomUUID();

const readCurrentSex = async (tx: Transaction, db: Firestore, birdId: string): Promise<string | undefined> => {
  const snapshot = await tx.get(db.collection(collections.sexHistory).where("birdId", "==", birdId));
  const entries = snapshot.docs.map((doc) => doc.data()).filter((entry) => entry.sex !== "unknown")
    .sort((a, b) => String(b.determinedOn ?? "").localeCompare(String(a.determinedOn ?? "")));
  return entries[0]?.sex;
};

const membersForPairAt = async (tx: Transaction, db: Firestore, pairId: string, on: string): Promise<PairMember[]> => {
  const snapshot = await tx.get(db.collection(collections.pairMembers).where("pairId", "==", pairId));
  return currentMembersAt(snapshot.docs.map((doc) => doc.data() as PairMember), on);
};

const directParentsOf = async (tx: Transaction, db: Firestore, birdId: string): Promise<string[] | undefined> => {
  const bird = await tx.get(db.collection(collections.birds).doc(birdId));
  const eggId = bird.data()?.eggId;
  if (!bird.exists || typeof eggId !== "string" || !eggId) return undefined;
  const egg = await tx.get(db.collection(collections.eggs).doc(eggId));
  const cycleId = egg.data()?.cycleId;
  if (!egg.exists || typeof cycleId !== "string") return undefined;
  const cycle = await tx.get(db.collection(collections.breedingCycles).doc(cycleId));
  const pairId = cycle.data()?.pairId;
  if (!cycle.exists || typeof pairId !== "string") return undefined;
  const members = await membersForPairAt(tx, db, pairId, String(cycle.data()?.startedOn ?? ""));
  if (members.length !== 2) return undefined;
  return members.map((member) => member.birdId);
};

const ancestorIds = async (tx: Transaction, db: Firestore, birdId: string, depth = 3): Promise<Set<string> | undefined> => {
  if (depth < 1) return new Set();
  const parents = await directParentsOf(tx, db, birdId);
  if (!parents) return undefined;
  const ancestors = new Set(parents);
  for (const parent of parents) {
    const inherited = await ancestorIds(tx, db, parent, depth - 1);
    if (inherited) for (const ancestor of inherited) ancestors.add(ancestor);
  }
  return ancestors;
};

const assertRingAvailable = async (tx: Transaction, db: Firestore, ringId: string): Promise<void> => {
  const existing = await tx.get(db.collection(collections.birds).where("ringId", "==", ringId));
  if (!existing.empty) fail("already-exists", "ringId is already assigned to a bird.");
};

const openMembersForPair = async (tx: Transaction, db: Firestore, pairId: string): Promise<Array<{ ref: FirebaseFirestore.DocumentReference; data: PairMember }>> => {
  const snapshot = await tx.get(db.collection(collections.pairMembers).where("pairId", "==", pairId));
  return snapshot.docs.filter((doc) => !doc.data().effectiveTo).map((doc) => ({ ref: doc.ref, data: doc.data() as PairMember }));
};

const validateActivation = async (tx: Transaction, db: Firestore, pairId: string, members: PairMember[], activeOn: string): Promise<KinshipResult> => {
  const sexes = new Map<string, string>();
  for (const member of members) sexes.set(member.birdId, await readCurrentSex(tx, db, member.birdId) ?? "unknown");
  const { maleId, femaleId } = validatePairMembers(members, sexes);
  const competing = await Promise.all([maleId, femaleId].map((birdId) => tx.get(db.collection(collections.pairMembers).where("birdId", "==", birdId))));
  for (const member of competing.flatMap((snapshot) => snapshot.docs.map((doc) => doc.data() as PairMember))) {
    if (member.pairId === pairId || !member.pairId || !currentMembersAt([member], activeOn).length) continue;
    const otherPair = await tx.get(db.collection(collections.pairs).doc(member.pairId));
    if (otherPair.exists && otherPair.data()?.status === "active") fail("failed-precondition", "Bird already has an overlapping active pair membership.");
  }
  const maleParents = await directParentsOf(tx, db, maleId);
  const femaleParents = await directParentsOf(tx, db, femaleId);
  const kinship = classifyKinship(maleId, femaleId, (birdId) => birdId === maleId ? maleParents : femaleParents);
  if (kinship.status === "blocked") fail("failed-precondition", `Pair is blocked by kinship policy: ${kinship.reason}.`);
  if (kinship.status !== "clear") return kinship;
  const [maleAncestors, femaleAncestors] = await Promise.all([ancestorIds(tx, db, maleId), ancestorIds(tx, db, femaleId)]);
  return maleAncestors && femaleAncestors && [...maleAncestors].some((ancestor) => femaleAncestors.has(ancestor)) ? { status: "warning", reason: "other_detectable_kinship" } : { status: "clear" };
};

/** Advisory only: durable ring assignment occurs atomically in createBirdFromEgg. */
export const checkRingIdAvailability = async (db: Firestore, input: { ringId: unknown }): Promise<{ ringId: string; available: true }> => {
  const ringId = normalizeRingId(input.ringId);
  await db.runTransaction(async (tx) => assertRingAvailable(tx, db, ringId));
  return { ringId, available: true };
};

export const activatePair = async (db: Firestore, input: { pairId: unknown; activeOn: unknown }): Promise<{ pairId: string; kinship: KinshipResult }> => {
  const pairId = requireId(input.pairId, "pairId");
  const activeOn = requireDate(input.activeOn, "activeOn");
  return db.runTransaction(async (tx) => {
    const pairRef = db.collection(collections.pairs).doc(pairId);
    const pair = await tx.get(pairRef);
    if (!pair.exists) fail("not-found", "Pair not found.");
    if (pair.data()?.status !== "draft") fail("failed-precondition", "Only a draft pair can be activated.");
    const members = await membersForPairAt(tx, db, pairId, activeOn);
    const kinship = await validateActivation(tx, db, pairId, members, activeOn);
    tx.update(pairRef, { status: "active", updatedAt: now() });
    return { pairId, kinship };
  });
};

const closePair = async (db: Firestore, input: { pairId: unknown; endedOn: unknown; endedReason?: unknown }, status: "inactive" | "retired"): Promise<{ pairId: string; status: string }> => {
  const pairId = requireId(input.pairId, "pairId"); const endedOn = requireDate(input.endedOn, "endedOn");
  const endedReason = typeof input.endedReason === "string" && input.endedReason.trim() ? input.endedReason.trim() : undefined;
  return db.runTransaction(async (tx) => {
    const pairRef = db.collection(collections.pairs).doc(pairId);
    const [pair, members, cycles] = await Promise.all([tx.get(pairRef), openMembersForPair(tx, db, pairId), tx.get(db.collection(collections.breedingCycles).where("pairId", "==", pairId).where("status", "==", "active"))]);
    if (!pair.exists) fail("not-found", "Pair not found.");
    if (pair.data()?.status !== "active") fail("failed-precondition", "Only an active pair can change lifecycle status.");
    if (endedOn < String(pair.data()?.startedOn ?? "")) fail("invalid-argument", "endedOn cannot precede startedOn.");
    if (!cycles.empty) fail("failed-precondition", "Active breeding cycles must be resolved before ending a pair.");
    tx.update(pairRef, { status, endedOn, updatedAt: now() });
    for (const member of members) tx.update(member.ref, { effectiveTo: endedOn, ...(endedReason ? { endedReason } : {}), updatedAt: now() });
    return { pairId, status };
  });
};

export const deactivatePair = (db: Firestore, input: { pairId: unknown; endedOn: unknown; endedReason?: unknown }) => closePair(db, input, "inactive");
export const retirePair = (db: Firestore, input: { pairId: unknown; endedOn: unknown; endedReason?: unknown }) => closePair(db, input, "retired");

export const reactivatePair = async (db: Firestore, input: { pairId: unknown; activeOn: unknown }): Promise<{ pairId: string; kinship: KinshipResult }> => {
  const pairId = requireId(input.pairId, "pairId"); const activeOn = requireDate(input.activeOn, "activeOn");
  return db.runTransaction(async (tx) => {
    const pairRef = db.collection(collections.pairs).doc(pairId);
    const [pair, history] = await Promise.all([tx.get(pairRef), tx.get(db.collection(collections.pairMembers).where("pairId", "==", pairId))]);
    if (!pair.exists) fail("not-found", "Pair not found.");
    if (pair.data()?.status !== "inactive") fail("failed-precondition", "Only an inactive pair can be reactivated.");
    const latestByRole = new Map<"male" | "female", PairMember>();
    for (const member of history.docs.map((doc) => doc.data() as PairMember)) if ((member.role === "male" || member.role === "female") && (!latestByRole.has(member.role) || String(latestByRole.get(member.role)?.effectiveFrom) < member.effectiveFrom)) latestByRole.set(member.role, member);
    const members = [latestByRole.get("male"), latestByRole.get("female")].filter((member): member is PairMember => Boolean(member)).map((member) => ({ ...member, effectiveFrom: activeOn, effectiveTo: undefined }));
    const kinship = await validateActivation(tx, db, pairId, members, activeOn);
    tx.update(pairRef, { status: "active", endedOn: FieldValue.delete(), updatedAt: now() });
    for (const member of members) tx.create(db.collection(collections.pairMembers).doc(id()), { pairId, birdId: member.birdId, role: member.role, effectiveFrom: activeOn, createdAt: now(), updatedAt: now() });
    return { pairId, kinship };
  });
};

export const assignPairToCage = async (db: Firestore, input: { pairId: unknown; cageId: unknown; startsOn: unknown; endsOn?: unknown; notes?: unknown }): Promise<{ cageAssignmentId: string }> => {
  const pairId = requireId(input.pairId, "pairId"); const cageId = requireId(input.cageId, "cageId"); const startsOn = requireDate(input.startsOn, "startsOn");
  const endsOn = input.endsOn === undefined || input.endsOn === "" ? undefined : requireDate(input.endsOn, "endsOn");
  if (endsOn && endsOn < startsOn) fail("invalid-argument", "endsOn cannot precede startsOn.");
  return db.runTransaction(async (tx) => {
    const [pair, cage, byPair, byCage] = await Promise.all([tx.get(db.collection(collections.pairs).doc(pairId)), tx.get(db.collection("cages").doc(cageId)), tx.get(db.collection(collections.cageAssignments).where("pairId", "==", pairId)), tx.get(db.collection(collections.cageAssignments).where("cageId", "==", cageId))]);
    if (!pair.exists || pair.data()?.status !== "active") fail("failed-precondition", "Pair must be active before cage assignment.");
    if (!cage.exists) fail("not-found", "Cage not found.");
    for (const assignment of [...byPair.docs, ...byCage.docs]) { const data = assignment.data(); if (intervalsOverlap(startsOn, endsOn, String(data.startsOn), data.endsOn)) fail("failed-precondition", "Cage or pair assignment interval overlaps an existing assignment."); }
    const cageAssignmentId = id(); tx.create(db.collection(collections.cageAssignments).doc(cageAssignmentId), { pairId, cageId, startsOn, ...(endsOn ? { endsOn } : {}), ...(typeof input.notes === "string" ? { notes: input.notes } : {}), createdAt: now(), updatedAt: now() });
    return { cageAssignmentId };
  });
};

export const closeCageAssignment = async (db: Firestore, input: { cageAssignmentId: unknown; endsOn: unknown; endedReason?: unknown }): Promise<{ cageAssignmentId: string }> => {
  const cageAssignmentId = requireId(input.cageAssignmentId, "cageAssignmentId"); const endsOn = requireDate(input.endsOn, "endsOn");
  const endedReason = typeof input.endedReason === "string" && input.endedReason.trim() ? input.endedReason.trim() : undefined;
  return db.runTransaction(async (tx) => {
    const assignmentRef = db.collection(collections.cageAssignments).doc(cageAssignmentId); const assignment = await tx.get(assignmentRef);
    if (!assignment.exists) fail("not-found", "Cage assignment not found.");
    if (assignment.data()?.endsOn) fail("failed-precondition", "Cage assignment is already closed.");
    if (endsOn < String(assignment.data()?.startsOn ?? "")) fail("invalid-argument", "endsOn cannot precede startsOn.");
    tx.update(assignmentRef, { endsOn, ...(endedReason ? { endedReason } : {}), updatedAt: now() });
    return { cageAssignmentId };
  });
};

export const movePairToCage = async (db: Firestore, input: { pairId: unknown; cageId: unknown; startsOn: unknown; endedReason?: unknown; notes?: unknown }): Promise<{ cageAssignmentId: string }> => {
  const pairId = requireId(input.pairId, "pairId"); const cageId = requireId(input.cageId, "cageId"); const startsOn = requireDate(input.startsOn, "startsOn");
  const endedReason = typeof input.endedReason === "string" && input.endedReason.trim() ? input.endedReason.trim() : undefined;
  return db.runTransaction(async (tx) => {
    const [pair, cage, byPair, byCage] = await Promise.all([tx.get(db.collection(collections.pairs).doc(pairId)), tx.get(db.collection("cages").doc(cageId)), tx.get(db.collection(collections.cageAssignments).where("pairId", "==", pairId)), tx.get(db.collection(collections.cageAssignments).where("cageId", "==", cageId))]);
    if (!pair.exists || pair.data()?.status !== "active") fail("failed-precondition", "Pair must be active before moving cages.");
    if (!cage.exists) fail("not-found", "Cage not found.");
    const open = byPair.docs.filter((doc) => !doc.data().endsOn); if (open.length !== 1) fail("failed-precondition", "Pair must have exactly one open cage assignment to move.");
    const current = open[0]; if (startsOn < String(current.data().startsOn)) fail("invalid-argument", "startsOn cannot precede the current assignment.");
    for (const assignment of [...byPair.docs.filter((doc) => doc.id !== current.id), ...byCage.docs]) { const data = assignment.data(); if (intervalsOverlap(startsOn, undefined, String(data.startsOn), data.endsOn)) fail("failed-precondition", "Cage or pair assignment interval overlaps an existing assignment."); }
    const cageAssignmentId = id();
    tx.update(current.ref, { endsOn: startsOn, ...(endedReason ? { endedReason } : {}), updatedAt: now() });
    tx.create(db.collection(collections.cageAssignments).doc(cageAssignmentId), { pairId, cageId, startsOn, ...(typeof input.notes === "string" ? { notes: input.notes } : {}), createdAt: now(), updatedAt: now() });
    return { cageAssignmentId };
  });
};

export const createBreedingCycle = async (db: Firestore, input: { pairId: unknown; startedOn: unknown; code?: unknown; notes?: unknown }): Promise<{ breedingCycleId: string }> => {
  const pairId = requireId(input.pairId, "pairId"); const startedOn = requireDate(input.startedOn, "startedOn");
  return db.runTransaction(async (tx) => { const pair = await tx.get(db.collection(collections.pairs).doc(pairId)); if (!pair.exists || pair.data()?.status !== "active") fail("failed-precondition", "Breeding cycle requires an active pair."); const members = await membersForPairAt(tx, db, pairId, startedOn); const sexes = new Map<string, string>(); for (const member of members) sexes.set(member.birdId, await readCurrentSex(tx, db, member.birdId) ?? "unknown"); validatePairMembers(members, sexes); const breedingCycleId = id(); tx.create(db.collection(collections.breedingCycles).doc(breedingCycleId), { pairId, startedOn, status: "active", ...(typeof input.code === "string" ? { code: input.code } : {}), ...(typeof input.notes === "string" ? { notes: input.notes } : {}), createdAt: now(), updatedAt: now() }); return { breedingCycleId }; });
};

const transitionCycle = async (db: Firestore, input: { breedingCycleId: unknown; endedOn: unknown }, status: "closed" | "cancelled"): Promise<{ breedingCycleId: string; status: string }> => {
  const breedingCycleId = requireId(input.breedingCycleId, "breedingCycleId"); const endedOn = requireDate(input.endedOn, "endedOn");
  return db.runTransaction(async (tx) => {
    const cycleRef = db.collection(collections.breedingCycles).doc(breedingCycleId);
    const [cycle, eggs] = await Promise.all([tx.get(cycleRef), tx.get(db.collection(collections.eggs).where("cycleId", "==", breedingCycleId))]);
    if (!cycle.exists) fail("not-found", "Breeding cycle not found.");
    if (cycle.data()?.status !== "active") fail("failed-precondition", "Only an active breeding cycle can transition.");
    if (endedOn < String(cycle.data()?.startedOn ?? "")) fail("invalid-argument", "endedOn cannot precede startedOn.");
    if (eggs.docs.some((egg) => ["laid", "fertile"].includes(String(egg.data().status)))) fail("failed-precondition", "Resolve laid or fertile eggs before closing a breeding cycle.");
    tx.update(cycleRef, { status, endedOn, updatedAt: now() });
    return { breedingCycleId, status };
  });
};

export const closeBreedingCycle = (db: Firestore, input: { breedingCycleId: unknown; endedOn: unknown }) => transitionCycle(db, input, "closed");
export const cancelBreedingCycle = (db: Firestore, input: { breedingCycleId: unknown; endedOn: unknown }) => transitionCycle(db, input, "cancelled");

const allowedEggTransitions: Record<string, string[]> = { laid: ["fertile", "infertile", "lost", "discarded"], fertile: ["lost", "discarded"] };

export const transitionEggStatus = async (db: Firestore, input: { eggId: unknown; targetStatus: unknown }): Promise<{ eggId: string; status: string }> => {
  const eggId = requireId(input.eggId, "eggId");
  if (typeof input.targetStatus !== "string" || input.targetStatus === "hatched") fail("invalid-argument", "targetStatus is not an allowed non-hatch Egg status.");
  const targetStatus = input.targetStatus as string;
  return db.runTransaction(async (tx) => {
    const eggRef = db.collection(collections.eggs).doc(eggId);
    const [egg, birds] = await Promise.all([tx.get(eggRef), tx.get(db.collection(collections.birds).where("eggId", "==", eggId))]);
    if (!egg.exists) fail("not-found", "Egg not found.");
    const currentStatus = String(egg.data()?.status);
    if (!allowedEggTransitions[currentStatus]?.includes(targetStatus)) fail("failed-precondition", "Egg status transition is not allowed.");
    if (!birds.empty) fail("failed-precondition", "An Egg with a Bird cannot transition through the generic status operation.");
    tx.update(eggRef, { status: targetStatus, updatedAt: now() });
    return { eggId, status: targetStatus };
  });
};

export const createBirdFromEgg = async (db: Firestore, input: Record<string, unknown>): Promise<{ birdId: string; ringId: string }> => {
  assertNoCanonicalParentageInput(input); const eggId = requireId(input.eggId, "eggId"); const ringId = normalizeRingId(input.ringId); if (input.origin !== "farm_hatched") fail("invalid-argument", "origin must be farm_hatched when creating a bird from an egg."); if (typeof input.displayName !== "string" || !input.displayName.trim()) fail("invalid-argument", "displayName is required."); const displayName = (input.displayName as string).trim();
  return db.runTransaction(async (tx) => { const eggRef = db.collection(collections.eggs).doc(eggId); const egg = await tx.get(eggRef); if (!egg.exists) fail("not-found", "Egg not found."); if (!["laid", "fertile"].includes(String(egg.data()?.status))) fail("failed-precondition", "Egg must be laid or fertile before hatching."); await assertRingAvailable(tx, db, ringId); const existingBird = await tx.get(db.collection(collections.birds).where("eggId", "==", eggId)); if (!existingBird.empty) fail("already-exists", "This egg already has a bird."); const birdId = id(); tx.create(db.collection(collections.birds).doc(birdId), { ringId, origin: "farm_hatched", eggId, displayName, status: "active", passportStatus: "draft", ...(typeof input.mutation === "string" ? { mutation: input.mutation } : {}), ...(typeof input.hatchedOn === "string" ? { hatchedOn: requireDate(input.hatchedOn, "hatchedOn") } : {}), createdAt: now(), updatedAt: now() }); tx.update(eggRef, { status: "hatched", updatedAt: now() }); return { birdId, ringId }; });
};

const externalOrigins = new Set(["external", "purchased", "rescued", "unknown"]);

export const createExternalBird = async (db: Firestore, input: Record<string, unknown>): Promise<{ birdId: string; ringId: string }> => {
  assertNoCanonicalParentageInput(input);
  if ("eggId" in input) fail("invalid-argument", "eggId is not accepted for an external bird.");
  const ringId = normalizeRingId(input.ringId);
  if (typeof input.displayName !== "string" || !input.displayName.trim()) fail("invalid-argument", "displayName is required.");
  const displayName = (input.displayName as string).trim();
  if (typeof input.origin !== "string" || !externalOrigins.has(input.origin)) fail("invalid-argument", "origin must be external, purchased, rescued, or unknown.");
  const origin = input.origin;
  const mutation = typeof input.mutation === "string" && input.mutation.trim() ? input.mutation.trim() : undefined;
  const hatchedOn = input.hatchedOn === undefined || input.hatchedOn === "" ? undefined : requireDate(input.hatchedOn, "hatchedOn");
  return db.runTransaction(async (tx) => {
    await assertRingAvailable(tx, db, ringId);
    const birdId = id();
    tx.create(db.collection(collections.birds).doc(birdId), { ringId, displayName, origin, status: "active", passportStatus: "draft", ...(mutation ? { mutation } : {}), ...(hatchedOn ? { hatchedOn } : {}), createdAt: now(), updatedAt: now() });
    return { birdId, ringId };
  });
};
