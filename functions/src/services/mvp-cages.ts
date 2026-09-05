import { FieldValue, Firestore, Transaction } from "firebase-admin/firestore";
import { fail } from "../domain/errors.js";
import { classifyKinship, KinshipResult } from "../domain/kinship.js";
import { currentMembersAt, PairMember, validatePairMembers } from "../domain/pair.js";
import { intervalsOverlap, normalizeRingId, requireDate, requireId } from "../domain/validation.js";

const now = () => FieldValue.serverTimestamp();
const id = () => crypto.randomUUID();
const ref = (db: Firestore, collection: string, docId: string) => db.collection(collection).doc(docId);
const text = (value: unknown, name: string) => {
  if (typeof value !== "string" || !value.trim()) fail("invalid-argument", `${name} is required.`);
  return (value as string).trim();
};
const optionalText = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : undefined;
const enumValue = (value: unknown, name: string, allowed: readonly string[]) => {
  const result = text(value, name);
  if (!allowed.includes(result)) fail("invalid-argument", `Invalid ${name}.`);
  return result;
};
const capacityValue = (value: unknown) => {
  if (value === undefined || value === null || value === "") return undefined;
  const result = Number(value);
  if (!Number.isInteger(result) || result < 1) fail("invalid-argument", "capacity must be a positive integer.");
  return result;
};

const readCurrentSex = async (tx: Transaction, db: Firestore, birdId: string): Promise<string> => {
  const snapshot = await tx.get(db.collection("sexHistory").where("birdId", "==", birdId));
  const entries = snapshot.docs.map(doc => doc.data())
    .sort((a, b) => String(b.determinedOn ?? "").localeCompare(String(a.determinedOn ?? "")));
  return String(entries[0]?.sex ?? "unknown");
};

const membersForPairAt = async (tx: Transaction, db: Firestore, pairId: string, on: string): Promise<PairMember[]> => {
  const snapshot = await tx.get(db.collection("pairMembers").where("pairId", "==", pairId));
  return currentMembersAt(snapshot.docs.map(doc => doc.data() as PairMember), on);
};

const directParentsOf = async (tx: Transaction, db: Firestore, birdId: string): Promise<string[] | undefined> => {
  const bird = await tx.get(ref(db, "birds", birdId));
  const eggId = bird.data()?.eggId;
  if (!bird.exists || typeof eggId !== "string" || !eggId) return undefined;
  const egg = await tx.get(ref(db, "eggs", eggId));
  const cycleId = egg.data()?.cycleId;
  if (!egg.exists || typeof cycleId !== "string" || !cycleId) return undefined;
  const cycle = await tx.get(ref(db, "breedingCycles", cycleId));
  const pairId = cycle.data()?.pairId;
  if (!cycle.exists || typeof pairId !== "string" || !pairId) return undefined;
  const members = await membersForPairAt(tx, db, pairId, String(cycle.data()?.startedOn ?? ""));
  return members.length === 2 ? members.map(member => member.birdId) : undefined;
};

const ancestorIds = async (tx: Transaction, db: Firestore, birdId: string, depth = 3): Promise<Set<string> | undefined> => {
  if (depth < 1) return new Set();
  const parents = await directParentsOf(tx, db, birdId);
  if (!parents) return undefined;
  const result = new Set(parents);
  for (const parentId of parents) {
    const inherited = await ancestorIds(tx, db, parentId, depth - 1);
    if (inherited) for (const ancestor of inherited) result.add(ancestor);
  }
  return result;
};

const validateNewActivePair = async (tx: Transaction, db: Firestore, maleBirdId: string, femaleBirdId: string, activeOn: string): Promise<KinshipResult> => {
  const [maleSex, femaleSex] = await Promise.all([
    readCurrentSex(tx, db, maleBirdId),
    readCurrentSex(tx, db, femaleBirdId),
  ]);
  validatePairMembers([
    { pairId: "NEW", birdId: maleBirdId, role: "male", effectiveFrom: activeOn },
    { pairId: "NEW", birdId: femaleBirdId, role: "female", effectiveFrom: activeOn },
  ], new Map([[maleBirdId, maleSex], [femaleBirdId, femaleSex]]));

  for (const birdId of [maleBirdId, femaleBirdId]) {
    const memberships = await tx.get(db.collection("pairMembers").where("birdId", "==", birdId));
    for (const memberDoc of memberships.docs) {
      const member = memberDoc.data() as PairMember;
      if (!currentMembersAt([member], activeOn).length) continue;
      const pair = await tx.get(ref(db, "pairs", member.pairId));
      if (pair.exists && pair.data()?.status === "active") fail("failed-precondition", "Bird already has an active pair.");
    }
  }

  const maleParents = await directParentsOf(tx, db, maleBirdId);
  const femaleParents = await directParentsOf(tx, db, femaleBirdId);
  const kinship = classifyKinship(maleBirdId, femaleBirdId, birdId => birdId === maleBirdId ? maleParents : femaleParents);
  if (kinship.status === "blocked") fail("failed-precondition", `Pair is blocked by kinship policy: ${kinship.reason}.`);
  if (kinship.status !== "clear") return kinship;
  const [maleAncestors, femaleAncestors] = await Promise.all([
    ancestorIds(tx, db, maleBirdId),
    ancestorIds(tx, db, femaleBirdId),
  ]);
  return maleAncestors && femaleAncestors && [...maleAncestors].some(ancestor => femaleAncestors.has(ancestor))
    ? { status: "warning", reason: "other_detectable_kinship" }
    : { status: "clear" };
};

const openBirdAssignments = async (tx: Transaction, db: Firestore, birdId: string) => {
  const snapshot = await tx.get(db.collection("birdCageAssignments").where("birdId", "==", birdId));
  return snapshot.docs.filter(doc => !doc.data().endsOn);
};

const moveBirdInTransaction = async (tx: Transaction, db: Firestore, birdId: string, cageId: string, movedOn: string, reason?: string) => {
  const open = await openBirdAssignments(tx, db, birdId);
  if (open.length > 1) fail("failed-precondition", "Bird has more than one open cage assignment.");
  const current = open[0];
  if (current?.data().cageId === cageId) return false;
  if (current) {
    if (movedOn < String(current.data().startsOn ?? "")) fail("invalid-argument", "movedOn cannot precede the current cage assignment.");
    tx.update(current.ref, { endsOn: movedOn, ...(reason ? { endedReason: reason } : {}), updatedAt: now() });
  }
  tx.create(ref(db, "birdCageAssignments", id()), { birdId, cageId, startsOn: movedOn, createdAt: now(), updatedAt: now() });
  return true;
};

const assertCageCanReceivePair = async (tx: Transaction, db: Firestore, cageId: string, maleBirdId: string, femaleBirdId: string, startsOn: string) => {
  const cage = await tx.get(ref(db, "cages", cageId));
  if (!cage.exists) fail("not-found", "Cage not found.");
  const cageData = cage.data()!;
  if (cageData.status !== "active") fail("failed-precondition", "Destination cage must be active.");
  if (cageData.type && cageData.type !== "breeding") fail("failed-precondition", "Active pairs must use a breeding cage.");

  const birdAssignments = await tx.get(db.collection("birdCageAssignments").where("cageId", "==", cageId));
  const otherBirds = birdAssignments.docs.filter(doc => !doc.data().endsOn && ![maleBirdId, femaleBirdId].includes(String(doc.data().birdId)));
  if (otherBirds.length) fail("failed-precondition", "Breeding cage already contains another bird.");
  const capacity = typeof cageData.capacity === "number" ? cageData.capacity : undefined;
  if (capacity !== undefined && capacity < 2) fail("failed-precondition", "Breeding cage capacity must allow two birds.");

  const pairAssignments = await tx.get(db.collection("cageAssignments").where("cageId", "==", cageId));
  for (const assignment of pairAssignments.docs) {
    const data = assignment.data();
    if (intervalsOverlap(startsOn, undefined, String(data.startsOn), data.endsOn)) fail("failed-precondition", "Breeding cage is already assigned to another pair.");
  }
  return cageData;
};

export const createMvpCage = async (db: Firestore, input: Record<string, unknown>) => {
  const code = text(input.code, "code").toUpperCase();
  const name = text(input.name, "name");
  const type = enumValue(input.type, "type", ["breeding", "holding", "individual"]);
  const status = enumValue(input.status, "status", ["active", "maintenance", "inactive"]);
  const capacity = capacityValue(input.capacity);
  const location = optionalText(input.location);
  const notes = optionalText(input.notes);
  return db.runTransaction(async tx => {
    const duplicate = await tx.get(db.collection("cages").where("code", "==", code));
    if (!duplicate.empty) fail("already-exists", "Cage code already exists.");
    const cageId = id();
    tx.create(ref(db, "cages", cageId), { code, name, type, status, ...(capacity ? { capacity } : {}), ...(location ? { location } : {}), ...(notes ? { notes } : {}), createdAt: now(), updatedAt: now() });
    return { cageId };
  });
};

export const listMvpCages = async (db: Firestore) => {
  const [cages, assignments] = await Promise.all([
    db.collection("cages").get(),
    db.collection("birdCageAssignments").get(),
  ]);
  const occupancy = new Map<string, number>();
  for (const assignment of assignments.docs) if (!assignment.data().endsOn) occupancy.set(String(assignment.data().cageId), (occupancy.get(String(assignment.data().cageId)) ?? 0) + 1);
  return cages.docs.map(doc => ({ cageId: doc.id, ...doc.data(), occupancyCount: occupancy.get(doc.id) ?? 0 }))
    .sort((a: any, b: any) => String(a.code ?? "").localeCompare(String(b.code ?? "")));
};

export const listMvpBirds = async (db: Firestore) => {
  const [birds, cages, assignments, sexHistory] = await Promise.all([
    db.collection("birds").get(), db.collection("cages").get(), db.collection("birdCageAssignments").get(), db.collection("sexHistory").get(),
  ]);
  const cageMap = new Map(cages.docs.map(doc => [doc.id, doc.data()]));
  const currentByBird = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
  for (const assignment of assignments.docs) {
    const data = assignment.data(); if (data.endsOn) continue;
    const previous = currentByBird.get(String(data.birdId));
    if (!previous || String(previous.data().startsOn ?? "") < String(data.startsOn ?? "")) currentByBird.set(String(data.birdId), assignment);
  }
  const sexByBird = new Map<string, any>();
  for (const entry of sexHistory.docs) {
    const data = entry.data(); const previous = sexByBird.get(String(data.birdId));
    if (!previous || String(previous.determinedOn ?? "") < String(data.determinedOn ?? "")) sexByBird.set(String(data.birdId), data);
  }
  return birds.docs.map(doc => {
    const bird = doc.data(); const assignment = currentByBird.get(doc.id)?.data(); const cage = assignment ? cageMap.get(String(assignment.cageId)) : undefined;
    return { birdId: doc.id, ...bird, currentSex: sexByBird.get(doc.id)?.sex ?? "unknown", currentCageId: assignment?.cageId ?? null, currentCageCode: cage?.code ?? null, currentCageName: cage?.name ?? null, currentCageType: cage?.type ?? null };
  }).sort((a: any, b: any) => String(a.ringId ?? "").localeCompare(String(b.ringId ?? "")));
};

export const assignBirdToCageMvp = async (db: Firestore, input: Record<string, unknown>) => {
  const birdId = requireId(input.birdId, "birdId"); const cageId = requireId(input.cageId, "cageId"); const movedOn = requireDate(input.movedOn, "movedOn");
  return db.runTransaction(async tx => {
    const [bird, cage, memberships] = await Promise.all([
      tx.get(ref(db, "birds", birdId)), tx.get(ref(db, "cages", cageId)), tx.get(db.collection("pairMembers").where("birdId", "==", birdId)),
    ]);
    if (!bird.exists) fail("not-found", "Bird not found.");
    if (!cage.exists) fail("not-found", "Cage not found.");
    if (cage.data()?.status !== "active") fail("failed-precondition", "Destination cage must be active.");
    for (const membership of memberships.docs.map(doc => doc.data() as PairMember)) {
      if (!currentMembersAt([membership], movedOn).length) continue;
      const pair = await tx.get(ref(db, "pairs", membership.pairId));
      if (pair.exists && pair.data()?.status === "active" && pair.data()?.cageId !== cageId) fail("failed-precondition", "นกอยู่ในคู่ผสมพันธุ์ที่กำลังใช้งาน กรุณาย้ายทั้งคู่พร้อมกัน");
    }
    const existingAtCage = await tx.get(db.collection("birdCageAssignments").where("cageId", "==", cageId));
    const openAtCage = existingAtCage.docs.filter(doc => !doc.data().endsOn && doc.data().birdId !== birdId);
    const capacity = typeof cage.data()?.capacity === "number" ? cage.data()?.capacity : undefined;
    if (capacity !== undefined && openAtCage.length >= capacity) fail("failed-precondition", "Cage has reached capacity.");
    await moveBirdInTransaction(tx, db, birdId, cageId, movedOn, optionalText(input.reason));
    return { birdId, cageId };
  });
};

export const createActivePairInCageMvp = async (db: Firestore, input: Record<string, unknown>) => {
  const maleBirdId = requireId(input.maleBirdId, "maleBirdId"); const femaleBirdId = requireId(input.femaleBirdId, "femaleBirdId"); const cageId = requireId(input.cageId, "cageId"); const startedOn = requireDate(input.startedOn, "startedOn");
  if (maleBirdId === femaleBirdId) fail("invalid-argument", "Pair birds must be distinct.");
  const name = optionalText(input.name); const notes = optionalText(input.notes);
  return db.runTransaction(async tx => {
    const [male, female] = await Promise.all([tx.get(ref(db, "birds", maleBirdId)), tx.get(ref(db, "birds", femaleBirdId))]);
    if (!male.exists || !female.exists) fail("not-found", "Pair bird not found.");
    await assertCageCanReceivePair(tx, db, cageId, maleBirdId, femaleBirdId, startedOn);
    const kinship = await validateNewActivePair(tx, db, maleBirdId, femaleBirdId, startedOn);
    await moveBirdInTransaction(tx, db, maleBirdId, cageId, startedOn, "จับคู่ผสมพันธุ์");
    await moveBirdInTransaction(tx, db, femaleBirdId, cageId, startedOn, "จับคู่ผสมพันธุ์");
    const pairId = id();
    tx.create(ref(db, "pairs", pairId), { status: "active", startedOn, cageId, ...(name ? { name } : {}), ...(notes ? { notes } : {}), createdAt: now(), updatedAt: now() });
    tx.create(ref(db, "pairMembers", id()), { pairId, birdId: maleBirdId, role: "male", effectiveFrom: startedOn, createdAt: now(), updatedAt: now() });
    tx.create(ref(db, "pairMembers", id()), { pairId, birdId: femaleBirdId, role: "female", effectiveFrom: startedOn, createdAt: now(), updatedAt: now() });
    const cageAssignmentId = id();
    tx.create(ref(db, "cageAssignments", cageAssignmentId), { pairId, cageId, startsOn: startedOn, createdAt: now(), updatedAt: now() });
    return { pairId, cageId, kinship };
  });
};

export const moveActivePairToCageMvp = async (db: Firestore, input: Record<string, unknown>) => {
  const pairId = requireId(input.pairId, "pairId"); const cageId = requireId(input.cageId, "cageId"); const movedOn = requireDate(input.movedOn, "movedOn");
  return db.runTransaction(async tx => {
    const pairRef = ref(db, "pairs", pairId); const pair = await tx.get(pairRef);
    if (!pair.exists || pair.data()?.status !== "active") fail("failed-precondition", "Pair must be active.");
    const members = await membersForPairAt(tx, db, pairId, movedOn);
    const male = members.find(member => member.role === "male"); const female = members.find(member => member.role === "female");
    if (!male || !female) fail("failed-precondition", "Active pair must have one male and one female member.");
    await assertCageCanReceivePair(tx, db, cageId, male.birdId, female.birdId, movedOn);
    const pairAssignments = await tx.get(db.collection("cageAssignments").where("pairId", "==", pairId));
    const open = pairAssignments.docs.filter(doc => !doc.data().endsOn);
    if (open.length > 1) fail("failed-precondition", "Pair has more than one open cage assignment.");
    if (open[0]?.data().cageId !== cageId) {
      if (open[0]) tx.update(open[0].ref, { endsOn: movedOn, endedReason: "ย้ายกรงคู่ผสมพันธุ์", updatedAt: now() });
      tx.create(ref(db, "cageAssignments", id()), { pairId, cageId, startsOn: movedOn, createdAt: now(), updatedAt: now() });
    }
    await moveBirdInTransaction(tx, db, male.birdId, cageId, movedOn, "ย้ายกรงคู่ผสมพันธุ์");
    await moveBirdInTransaction(tx, db, female.birdId, cageId, movedOn, "ย้ายกรงคู่ผสมพันธุ์");
    tx.update(pairRef, { cageId, updatedAt: now() });
    return { pairId, cageId };
  });
};

export const createExternalBirdInCageMvp = async (db: Firestore, input: Record<string, unknown>) => {
  const ringId = normalizeRingId(input.ringId); const displayName = text(input.displayName, "displayName"); const cageId = requireId(input.cageId, "cageId");
  const origin = enumValue(input.origin, "origin", ["external", "purchased", "rescued", "unknown"]); const acquiredOn = input.acquiredOn ? requireDate(input.acquiredOn, "acquiredOn") : undefined; const mutation = optionalText(input.mutation);
  const movedOn = input.movedOn ? requireDate(input.movedOn, "movedOn") : (acquiredOn ?? requireDate(input.createdOn ?? new Date().toISOString().slice(0, 10), "movedOn"));
  return db.runTransaction(async tx => {
    const [duplicate, cage] = await Promise.all([tx.get(db.collection("birds").where("ringId", "==", ringId)), tx.get(ref(db, "cages", cageId))]);
    if (!duplicate.empty) fail("already-exists", "ringId is already assigned to a bird.");
    if (!cage.exists || cage.data()?.status !== "active") fail("failed-precondition", "Destination cage must be active.");
    const occupants = await tx.get(db.collection("birdCageAssignments").where("cageId", "==", cageId));
    const openCount = occupants.docs.filter(doc => !doc.data().endsOn).length; const capacity = typeof cage.data()?.capacity === "number" ? cage.data()?.capacity : undefined;
    if (capacity !== undefined && openCount >= capacity) fail("failed-precondition", "Cage has reached capacity.");
    const birdId = id();
    tx.create(ref(db, "birds", birdId), { ringId, origin, displayName, status: "active", passportStatus: "draft", ...(mutation ? { mutation } : {}), ...(acquiredOn ? { acquiredOn } : {}), createdAt: now(), updatedAt: now() });
    tx.create(ref(db, "birdCageAssignments", id()), { birdId, cageId, startsOn: movedOn, createdAt: now(), updatedAt: now() });
    return { birdId, ringId, cageId };
  });
};
