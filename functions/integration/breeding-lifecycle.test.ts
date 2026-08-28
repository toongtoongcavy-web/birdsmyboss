import assert from "node:assert/strict";
import test from "node:test";
import { Firestore } from "firebase-admin/firestore";
import {
  activatePair,
  assignPairToCage,
  cancelBreedingCycle,
  closeBreedingCycle,
  closeCageAssignment,
  createBirdFromEgg,
  deactivatePair,
  movePairToCage,
  reactivatePair,
  retirePair,
  transitionEggStatus,
} from "../src/services/firestore.js";

const db = new Firestore({ projectId: "birdsmyboss-v1-dev" });
const suffix = `lifecycle-${Date.now()}-${Math.random().toString(36).slice(2)}`;
let sequence = 0;
const key = (name: string) => `${name}-${suffix}-${sequence++}`;
const stamp = { createdAt: new Date(), updatedAt: new Date() };

const seedBird = async (sex: "male" | "female", birdId = key(`bird-${sex}`)) => {
  await db.collection("birds").doc(birdId).set({ ringId: key(`ring-${sex}`), origin: "external", displayName: birdId, status: "active", passportStatus: "draft", ...stamp });
  await db.collection("sexHistory").doc(key(`sex-${sex}`)).set({ birdId, sex, method: "dna", determinedOn: "2026-01-01", ...stamp });
  return birdId;
};

const seedPair = async (status: "draft" | "active" | "inactive" | "retired" = "active", ids?: { maleId: string; femaleId: string }) => {
  const maleId = ids?.maleId ?? await seedBird("male");
  const femaleId = ids?.femaleId ?? await seedBird("female");
  const pairId = key(`pair-${status}`);
  await db.collection("pairs").doc(pairId).set({ status, startedOn: "2026-01-01", ...stamp });
  for (const [birdId, role] of [[maleId, "male"], [femaleId, "female"]] as const) {
    await db.collection("pairMembers").doc(key(`member-${role}`)).set({ pairId, birdId, role, effectiveFrom: "2026-01-01", ...stamp });
  }
  return { pairId, maleId, femaleId };
};

const seedCycle = async (pairId: string, status: "active" | "closed" | "cancelled" = "active") => {
  const breedingCycleId = key(`cycle-${status}`);
  await db.collection("breedingCycles").doc(breedingCycleId).set({ pairId, status, startedOn: "2026-01-01", ...stamp });
  return breedingCycleId;
};

const seedEgg = async (status: string, cycleId?: string) => {
  const eggId = key(`egg-${status}`);
  await db.collection("eggs").doc(eggId).set({ cycleId: cycleId ?? key("cycle-reference"), sequenceNo: 1, laidOn: "2026-01-02", status, ...stamp });
  return eggId;
};

test("pair active to inactive ends current members, retains history, and may reactivate with new periods", async () => {
  const { pairId } = await seedPair();
  await deactivatePair(db, { pairId, endedOn: "2026-02-01", endedReason: "พักคู่" });
  const inactive = (await db.collection("pairs").doc(pairId).get()).data()!;
  assert.equal(inactive.status, "inactive"); assert.equal(inactive.endedOn, "2026-02-01");
  const closedMembers = await db.collection("pairMembers").where("pairId", "==", pairId).get();
  assert.equal(closedMembers.size, 2); assert.ok(closedMembers.docs.every((doc) => doc.data().effectiveTo === "2026-02-01"));
  await reactivatePair(db, { pairId, activeOn: "2026-02-02" });
  const history = await db.collection("pairMembers").where("pairId", "==", pairId).get();
  assert.equal((await db.collection("pairs").doc(pairId).get()).data()?.status, "active");
  assert.equal(history.size, 4); assert.equal(history.docs.filter((doc) => doc.data().effectiveTo === "2026-02-01").length, 2); assert.equal(history.docs.filter((doc) => !doc.data().effectiveTo).length, 2);
});

test("pair active to retired is terminal and active-cycle closure is required", async () => {
  const retired = await seedPair();
  await retirePair(db, { pairId: retired.pairId, endedOn: "2026-02-01" });
  await assert.rejects(reactivatePair(db, { pairId: retired.pairId, activeOn: "2026-02-02" }));
  const withCycle = await seedPair(); await seedCycle(withCycle.pairId);
  await assert.rejects(deactivatePair(db, { pairId: withCycle.pairId, endedOn: "2026-02-01" }));
  await assert.rejects(retirePair(db, { pairId: withCycle.pairId, endedOn: "2026-02-01" }));
});

test("pair activation rejects cross-pair membership overlap, including concurrent activation", async () => {
  const sharedMale = await seedBird("male");
  const activeFemale = await seedBird("female");
  const active = await seedPair("active", { maleId: sharedMale, femaleId: activeFemale });
  const blocked = await seedPair("draft", { maleId: sharedMale, femaleId: await seedBird("female") });
  await assert.rejects(activatePair(db, { pairId: blocked.pairId, activeOn: "2026-02-01" }));
  assert.equal((await db.collection("pairs").doc(active.pairId).get()).data()?.status, "active");

  const concurrentMale = await seedBird("male");
  const first = await seedPair("draft", { maleId: concurrentMale, femaleId: await seedBird("female") });
  const second = await seedPair("draft", { maleId: concurrentMale, femaleId: await seedBird("female") });
  const results = await Promise.allSettled([activatePair(db, { pairId: first.pairId, activeOn: "2026-02-01" }), activatePair(db, { pairId: second.pairId, activeOn: "2026-02-01" })]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
});

test("assignments close, move atomically, and use half-open interval boundaries", async () => {
  const pair = await seedPair(); const cageA = key("cage-a"); const cageB = key("cage-b");
  await db.collection("cages").doc(cageA).set({ code: cageA, name: cageA, status: "active", ...stamp });
  await db.collection("cages").doc(cageB).set({ code: cageB, name: cageB, status: "active", ...stamp });
  const initial = await assignPairToCage(db, { pairId: pair.pairId, cageId: cageA, startsOn: "2026-01-01" });
  await closeCageAssignment(db, { cageAssignmentId: initial.cageAssignmentId, endsOn: "2026-01-10", endedReason: "ย้ายกรง" });
  assert.equal((await db.collection("cageAssignments").doc(initial.cageAssignmentId).get()).data()?.endsOn, "2026-01-10");
  const reopened = await assignPairToCage(db, { pairId: pair.pairId, cageId: cageA, startsOn: "2026-01-10" });
  const moved = await movePairToCage(db, { pairId: pair.pairId, cageId: cageB, startsOn: "2026-01-20" });
  assert.equal((await db.collection("cageAssignments").doc(reopened.cageAssignmentId).get()).data()?.endsOn, "2026-01-20");
  assert.equal((await db.collection("cageAssignments").doc(moved.cageAssignmentId).get()).data()?.startsOn, "2026-01-20");

  const pairTwo = await seedPair();
  await assert.doesNotReject(assignPairToCage(db, { pairId: pairTwo.pairId, cageId: cageA, startsOn: "2026-01-20" }));
  const pairThree = await seedPair();
  await assert.rejects(assignPairToCage(db, { pairId: pairThree.pairId, cageId: cageA, startsOn: "2026-01-19" }));
});

test("concurrent assignment conflict permits at most one authoritative assignment", async () => {
  const cageId = key("cage-race"); await db.collection("cages").doc(cageId).set({ code: cageId, name: cageId, status: "active", ...stamp });
  const first = await seedPair(); const second = await seedPair();
  const results = await Promise.allSettled([assignPairToCage(db, { pairId: first.pairId, cageId, startsOn: "2026-01-01" }), assignPairToCage(db, { pairId: second.pairId, cageId, startsOn: "2026-01-01" })]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
});

test("active cycles close/cancel only after open Eggs are resolved and remain terminal", async () => {
  const pair = await seedPair(); const closable = await seedCycle(pair.pairId); await seedEgg("infertile", closable); await seedEgg("lost", closable);
  await closeBreedingCycle(db, { breedingCycleId: closable, endedOn: "2026-02-01" });
  assert.equal((await db.collection("breedingCycles").doc(closable).get()).data()?.status, "closed");
  await assert.rejects(cancelBreedingCycle(db, { breedingCycleId: closable, endedOn: "2026-02-02" }));
  const cancelled = await seedCycle(pair.pairId); await seedEgg("discarded", cancelled);
  await cancelBreedingCycle(db, { breedingCycleId: cancelled, endedOn: "2026-02-01" });
  assert.equal((await db.collection("breedingCycles").doc(cancelled).get()).data()?.status, "cancelled");
  for (const status of ["laid", "fertile"]) { const cycle = await seedCycle(pair.pairId); await seedEgg(status, cycle); await assert.rejects(closeBreedingCycle(db, { breedingCycleId: cycle, endedOn: "2026-02-01" })); }
});

test("Egg non-hatch transition graph is authoritative and terminal states cannot change", async () => {
  for (const targetStatus of ["fertile", "infertile", "lost", "discarded"]) { const eggId = await seedEgg("laid"); await assert.doesNotReject(transitionEggStatus(db, { eggId, targetStatus })); }
  for (const targetStatus of ["lost", "discarded"]) { const eggId = await seedEgg("fertile"); await assert.doesNotReject(transitionEggStatus(db, { eggId, targetStatus })); }
  await assert.rejects(transitionEggStatus(db, { eggId: await seedEgg("fertile"), targetStatus: "infertile" }));
  await assert.rejects(transitionEggStatus(db, { eggId: await seedEgg("laid"), targetStatus: "hatched" }));
  for (const status of ["infertile", "hatched", "lost", "discarded"]) await assert.rejects(transitionEggStatus(db, { eggId: await seedEgg(status), targetStatus: "lost" }));
});

test("createBirdFromEgg remains the exclusive laid/fertile hatch authority under concurrency", async () => {
  const pair = await seedPair(); const cycle = await seedCycle(pair.pairId);
  for (const status of ["laid", "fertile"]) {
    const eggId = await seedEgg(status, cycle); const result = await createBirdFromEgg(db, { eggId, ringId: key(`ring-hatch-${status}`), origin: "farm_hatched", displayName: `Hatched ${status}` });
    assert.equal((await db.collection("eggs").doc(eggId).get()).data()?.status, "hatched"); assert.ok((await db.collection("birds").doc(result.birdId).get()).exists);
  }
  const eggId = await seedEgg("laid", cycle);
  const results = await Promise.allSettled([createBirdFromEgg(db, { eggId, ringId: key("ring-race-hatch"), origin: "farm_hatched", displayName: "Race hatch" }), transitionEggStatus(db, { eggId, targetStatus: "infertile" })]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  const egg = (await db.collection("eggs").doc(eggId).get()).data()!;
  const birds = await db.collection("birds").where("eggId", "==", eggId).get();
  assert.equal(egg.status === "hatched", !birds.empty);
});
