import assert from "node:assert/strict";
import test from "node:test";
import { Firestore } from "firebase-admin/firestore";
import { assignBirdToCageMvp, createActivePairInCageMvp, createMvpCage, listMvpBirds, listMvpCages, moveActivePairToCageMvp } from "../src/services/mvp-cages.js";

const db = new Firestore({ projectId: "birdsmyboss-v1-dev" });
const prefix = `invariants-${Date.now()}-${Math.random().toString(36).slice(2)}`;
let sequence = 0;
const key = (name: string) => `${prefix}-${name}-${sequence++}`;

const createActiveBird = async (name: string, sex?: "male" | "female") => {
  const birdId = key(name);
  await db.collection("birds").doc(birdId).set({ ringId: key(`${name}-ring`), displayName: name, origin: "external", status: "active" });
  if (sex) await db.collection("sexHistory").doc(key(`${name}-sex`)).set({ birdId, sex, determinedOn: "2026-01-01" });
  return birdId;
};

type AssignmentRead = {
  assignmentId: string;
  birdId?: string;
  pairId?: string;
  cageId: string;
  startsOn: string;
  endsOn?: string;
  [key: string]: unknown;
};

const birdAssignments = async (birdId: string) => {
  const snapshot = await db.collection("birdCageAssignments").where("birdId", "==", birdId).get();
  return snapshot.docs.map(doc => ({ assignmentId: doc.id, ...doc.data() }) as AssignmentRead);
};

const pairAssignments = async (pairId: string) => {
  const snapshot = await db.collection("cageAssignments").where("pairId", "==", pairId).get();
  return snapshot.docs.map(doc => ({ assignmentId: doc.id, ...doc.data() }) as AssignmentRead);
};

test("farm-state invariants: terminal birds remain historical but do not occupy current cages", async () => {
  const cage = await createMvpCage(db, { code: key("terminal-cage"), name: "Terminal history cage", type: "holding", status: "active", capacity: 4 });
  const terminalIds: string[] = [];
  for (const status of ["sold", "given_away", "deceased", "lost"]) {
    const birdId = key(status); terminalIds.push(birdId);
    await db.collection("birds").doc(birdId).set({ ringId: key("ring"), displayName: status, origin: "external", status });
    await db.collection("birdCageAssignments").doc(key("assignment")).set({ birdId, cageId: cage.cageId, startsOn: "2026-01-01" });
  }
  const listedCage = (await listMvpCages(db)).find(row => row.cageId === cage.cageId);
  assert.equal(listedCage?.occupancyCount, 0);
  const listedBirds = await listMvpBirds(db);
  for (const birdId of terminalIds) {
    const listed = listedBirds.find(row => row.birdId === birdId);
    assert.ok(listed, "terminal bird remains readable");
    assert.equal(listed?.currentCageId, null);
  }
  const activeBirdId = key("active");
  await db.collection("birds").doc(activeBirdId).set({ ringId: key("active-ring"), displayName: "Active", origin: "external", status: "active" });
  await assert.doesNotReject(assignBirdToCageMvp(db, { birdId: activeBirdId, cageId: cage.cageId, movedOn: "2026-09-18" }));
  assert.equal((await listMvpCages(db)).find(row => row.cageId === cage.cageId)?.occupancyCount, 1);
});

test("farm-state invariants: active pair members remain in the same authoritative cage", async () => {
  const cage = await createMvpCage(db, { code: key("pair-cage"), name: "Pair cage", type: "breeding", status: "active", capacity: 2 });
  const maleBirdId = key("male"), femaleBirdId = key("female");
  await db.collection("birds").doc(maleBirdId).set({ ringId: key("male-ring"), displayName: "Male", origin: "external", status: "active" });
  await db.collection("birds").doc(femaleBirdId).set({ ringId: key("female-ring"), displayName: "Female", origin: "external", status: "active" });
  await db.collection("sexHistory").doc(key("male-sex")).set({ birdId: maleBirdId, sex: "male", determinedOn: "2026-01-01" });
  await db.collection("sexHistory").doc(key("female-sex")).set({ birdId: femaleBirdId, sex: "female", determinedOn: "2026-01-01" });
  await createActivePairInCageMvp(db, { maleBirdId, femaleBirdId, cageId: cage.cageId, startedOn: "2026-01-02" });
  const listed = await listMvpBirds(db);
  assert.deepEqual([listed.find(row => row.birdId === maleBirdId)?.currentCageId, listed.find(row => row.birdId === femaleBirdId)?.currentCageId], [cage.cageId, cage.cageId]);
  assert.equal((await listMvpCages(db)).find(row => row.cageId === cage.cageId)?.occupancyCount, 2);
});

test("farm-state invariants: terminal birds are rejected by authoritative cage operations", async () => {
  const holding = await createMvpCage(db, { code: key("terminal-target"), name: "Terminal target", type: "holding", status: "active", capacity: 8 });
  for (const status of ["sold", "given_away", "deceased", "lost"]) {
    const birdId = key(status);
    await db.collection("birds").doc(birdId).set({ ringId: key("ring"), displayName: status, origin: "external", status });
    await assert.rejects(assignBirdToCageMvp(db, { birdId, cageId: holding.cageId, movedOn: "2026-09-19" }), /Terminal bird/);
  }

  const breeding = await createMvpCage(db, { code: key("terminal-pair"), name: "Terminal pair", type: "breeding", status: "active", capacity: 2 });
  const maleBirdId = key("male"), femaleBirdId = key("female");
  await db.collection("birds").doc(maleBirdId).set({ ringId: key("male-ring"), displayName: "Male", origin: "external", status: "sold" });
  await db.collection("birds").doc(femaleBirdId).set({ ringId: key("female-ring"), displayName: "Female", origin: "external", status: "active" });
  await assert.rejects(createActivePairInCageMvp(db, { maleBirdId, femaleBirdId, cageId: breeding.cageId, startedOn: "2026-09-19" }), /Terminal bird/);

  await db.collection("birds").doc(maleBirdId).update({ status: "active" });
  await db.collection("sexHistory").doc(key("male-sex")).set({ birdId: maleBirdId, sex: "male", determinedOn: "2026-01-01" });
  await db.collection("sexHistory").doc(key("female-sex")).set({ birdId: femaleBirdId, sex: "female", determinedOn: "2026-01-01" });
  const pair = await createActivePairInCageMvp(db, { maleBirdId, femaleBirdId, cageId: breeding.cageId, startedOn: "2026-01-02" });
  const destination = await createMvpCage(db, { code: key("pair-destination"), name: "Pair destination", type: "breeding", status: "active", capacity: 2 });
  await db.collection("birds").doc(femaleBirdId).update({ status: "lost" });
  await assert.rejects(moveActivePairToCageMvp(db, { pairId: pair.pairId, cageId: destination.cageId, movedOn: "2026-09-19" }), /Terminal bird/);
});

test("CAGE-02 moves one eligible non-paired Bird while preserving assignment history", async () => {
  const source = await createMvpCage(db, { code: key("cage-02-source"), name: "CAGE-02 source", type: "holding", status: "active", capacity: 2 });
  const destination = await createMvpCage(db, { code: key("cage-02-destination"), name: "CAGE-02 destination", type: "holding", status: "active", capacity: 2 });
  const birdId = await createActiveBird("cage-02-bird");

  await assignBirdToCageMvp(db, { birdId, cageId: source.cageId, movedOn: "2026-09-01" });
  const original = await birdAssignments(birdId);
  assert.equal(original.length, 1);
  assert.equal(original[0].cageId, source.cageId);
  assert.equal(original[0].endsOn, undefined);

  await assignBirdToCageMvp(db, { birdId, cageId: destination.cageId, movedOn: "2026-09-12" });

  const history = await birdAssignments(birdId);
  assert.equal(history.length, 2, "the previous assignment is retained and a new assignment is appended");
  const prior = history.find(row => row.assignmentId === original[0].assignmentId);
  const current = history.find(row => row.cageId === destination.cageId && !row.endsOn);
  assert.equal(prior?.cageId, source.cageId);
  assert.equal(prior?.startsOn, "2026-09-01");
  assert.equal(prior?.endsOn, "2026-09-12");
  assert.equal(current?.startsOn, "2026-09-12");
  assert.equal(history.some(row => row.cageId === source.cageId && !row.endsOn), false);
  const bird = (await listMvpBirds(db)).find(row => row.birdId === birdId);
  assert.equal(bird?.currentCageId, destination.cageId);
  assert.equal((await listMvpCages(db)).find(row => row.cageId === source.cageId)?.occupancyCount, 0);
  assert.equal((await listMvpCages(db)).find(row => row.cageId === destination.cageId)?.occupancyCount, 1);
});

test("CAGE-05 rejects direct individual movement of an active Pair member without changing either Bird", async () => {
  const source = await createMvpCage(db, { code: key("cage-05-source"), name: "CAGE-05 source", type: "breeding", status: "active", capacity: 2 });
  const destination = await createMvpCage(db, { code: key("cage-05-destination"), name: "CAGE-05 destination", type: "breeding", status: "active", capacity: 2 });
  const maleBirdId = await createActiveBird("cage-05-male", "male");
  const femaleBirdId = await createActiveBird("cage-05-female", "female");
  const pair = await createActivePairInCageMvp(db, { maleBirdId, femaleBirdId, cageId: source.cageId, startedOn: "2026-09-01" });
  const maleBefore = await birdAssignments(maleBirdId);
  const femaleBefore = await birdAssignments(femaleBirdId);

  await assert.rejects(
    assignBirdToCageMvp(db, { birdId: maleBirdId, cageId: destination.cageId, movedOn: "2026-09-12" }),
    /กรุณาย้ายทั้งคู่พร้อมกัน/,
  );

  assert.deepEqual(await birdAssignments(maleBirdId), maleBefore);
  assert.deepEqual(await birdAssignments(femaleBirdId), femaleBefore);
  const birds = await listMvpBirds(db);
  assert.equal(birds.find(row => row.birdId === maleBirdId)?.currentCageId, source.cageId);
  assert.equal(birds.find(row => row.birdId === femaleBirdId)?.currentCageId, source.cageId);
  const pairState = await db.collection("pairs").doc(pair.pairId).get();
  assert.equal(pairState.data()?.status, "active");
  assert.equal(pairState.data()?.cageId, source.cageId);
});

test("CAGE-07 moves an active Pair together and keeps authoritative cage state consistent", async () => {
  const source = await createMvpCage(db, { code: key("cage-07-source"), name: "CAGE-07 source", type: "breeding", status: "active", capacity: 2 });
  const destination = await createMvpCage(db, { code: key("cage-07-destination"), name: "CAGE-07 destination", type: "breeding", status: "active", capacity: 2 });
  const maleBirdId = await createActiveBird("cage-07-male", "male");
  const femaleBirdId = await createActiveBird("cage-07-female", "female");
  const pair = await createActivePairInCageMvp(db, { maleBirdId, femaleBirdId, cageId: source.cageId, startedOn: "2026-09-01" });
  const maleOriginal = (await birdAssignments(maleBirdId))[0];
  const femaleOriginal = (await birdAssignments(femaleBirdId))[0];
  const pairOriginal = (await pairAssignments(pair.pairId))[0];

  await moveActivePairToCageMvp(db, { pairId: pair.pairId, cageId: destination.cageId, movedOn: "2026-09-12" });

  const maleHistory = await birdAssignments(maleBirdId);
  const femaleHistory = await birdAssignments(femaleBirdId);
  const cageHistory = await pairAssignments(pair.pairId);
  assert.equal(maleHistory.length, 2);
  assert.equal(femaleHistory.length, 2);
  assert.equal(cageHistory.length, 2);
  assert.equal(maleHistory.find(row => row.assignmentId === maleOriginal.assignmentId)?.endsOn, "2026-09-12");
  assert.equal(femaleHistory.find(row => row.assignmentId === femaleOriginal.assignmentId)?.endsOn, "2026-09-12");
  assert.equal(cageHistory.find(row => row.assignmentId === pairOriginal.assignmentId)?.endsOn, "2026-09-12");
  assert.equal(maleHistory.some(row => row.cageId === source.cageId && !row.endsOn), false);
  assert.equal(femaleHistory.some(row => row.cageId === source.cageId && !row.endsOn), false);
  assert.equal(cageHistory.some(row => row.cageId === source.cageId && !row.endsOn), false);
  assert.equal(maleHistory.some(row => row.cageId === destination.cageId && row.startsOn === "2026-09-12" && !row.endsOn), true);
  assert.equal(femaleHistory.some(row => row.cageId === destination.cageId && row.startsOn === "2026-09-12" && !row.endsOn), true);
  assert.equal(cageHistory.some(row => row.cageId === destination.cageId && row.startsOn === "2026-09-12" && !row.endsOn), true);
  const birds = await listMvpBirds(db);
  assert.equal(birds.find(row => row.birdId === maleBirdId)?.currentCageId, destination.cageId);
  assert.equal(birds.find(row => row.birdId === femaleBirdId)?.currentCageId, destination.cageId);
  const pairState = await db.collection("pairs").doc(pair.pairId).get();
  assert.equal(pairState.data()?.status, "active");
  assert.equal(pairState.data()?.cageId, destination.cageId);
  assert.equal((await listMvpCages(db)).find(row => row.cageId === source.cageId)?.occupancyCount, 0);
  assert.equal((await listMvpCages(db)).find(row => row.cageId === destination.cageId)?.occupancyCount, 2);
});
