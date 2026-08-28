import assert from "node:assert/strict";
import test from "node:test";
import { Firestore } from "firebase-admin/firestore";
import { activatePair, assignPairToCage, createBirdFromEgg } from "../src/services/firestore.js";

const projectId = "birdsmyboss-v1-dev";
const db = new Firestore({ projectId });
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const key = (name: string) => `${name}-${suffix}`;
const stamp = { createdAt: new Date(), updatedAt: new Date() };

const createEgg = async (eggId: string) => {
  const cycleId = key(`cycle-${eggId}`);
  await db.collection("pairs").doc(key(`pair-${eggId}`)).set({ status: "active", startedOn: "2026-01-01", ...stamp });
  await db.collection("breedingCycles").doc(cycleId).set({ pairId: key(`pair-${eggId}`), startedOn: "2026-01-01", status: "active", ...stamp });
  await db.collection("eggs").doc(eggId).set({ cycleId, sequenceNo: 1, laidOn: "2026-01-01", status: "fertile", ...stamp });
};

const birdInput = (eggId: string, ringId: string) => ({ eggId, ringId, origin: "farm_hatched", displayName: `Bird ${ringId}` });
const rejects = async (promise: Promise<unknown>) => assert.rejects(promise);

test("emulator: concurrent normalized ring attempts allow only one authoritative bird", async () => {
  const eggA = key("egg-ring-a"); const eggB = key("egg-ring-b"); await createEgg(eggA); await createEgg(eggB);
  const results = await Promise.allSettled([createBirdFromEgg(db, birdInput(eggA, "GC-001")), createBirdFromEgg(db, birdInput(eggB, "gc-001"))]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
});

test("emulator: one egg produces at most one bird", async () => {
  const eggId = key("egg-one"); await createEgg(eggId);
  const results = await Promise.allSettled([createBirdFromEgg(db, birdInput(eggId, key("RING-A"))), createBirdFromEgg(db, birdInput(eggId, key("RING-B")))]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
});

test("emulator: cage and pair overlap reject, sequential historical assignment succeeds", async () => {
  const pairId = key("pair-cage"); const cageA = key("cage-a"); const cageB = key("cage-b");
  await db.collection("pairs").doc(pairId).set({ status: "active", startedOn: "2026-01-01", ...stamp });
  await db.collection("cages").doc(cageA).set({ code: cageA, name: cageA, status: "active", ...stamp });
  await db.collection("cages").doc(cageB).set({ code: cageB, name: cageB, status: "active", ...stamp });
  await assignPairToCage(db, { pairId, cageId: cageA, startsOn: "2026-01-01", endsOn: "2026-01-31" });
  await rejects(assignPairToCage(db, { pairId, cageId: cageA, startsOn: "2026-01-15" }));
  await rejects(assignPairToCage(db, { pairId, cageId: cageB, startsOn: "2026-01-15" }));
  await assert.doesNotReject(assignPairToCage(db, { pairId, cageId: cageB, startsOn: "2026-02-01" }));
});

const seedPair = async (pairId: string, maleId: string, femaleId: string) => {
  await db.collection("pairs").doc(pairId).set({ status: "draft", startedOn: "2026-01-01", ...stamp });
  await db.collection("pairMembers").doc(key(`${pairId}-male`)).set({ pairId, birdId: maleId, role: "male", effectiveFrom: "2026-01-01", ...stamp });
  await db.collection("pairMembers").doc(key(`${pairId}-female`)).set({ pairId, birdId: femaleId, role: "female", effectiveFrom: "2026-01-01", ...stamp });
  await db.collection("sexHistory").doc(key(`${maleId}-sex`)).set({ birdId: maleId, sex: "male", determinedOn: "2026-01-01", method: "dna", ...stamp });
  await db.collection("sexHistory").doc(key(`${femaleId}-sex`)).set({ birdId: femaleId, sex: "female", determinedOn: "2026-01-01", method: "dna", ...stamp });
};

test("emulator: valid pair activates, parent-offspring and siblings reject", async () => {
  const validMale = key("valid-m"); const validFemale = key("valid-f");
  await db.collection("birds").doc(validMale).set({ ringId: key("valid-ring-m"), origin: "external", displayName: validMale, status: "active", ...stamp });
  await db.collection("birds").doc(validFemale).set({ ringId: key("valid-ring-f"), origin: "external", displayName: validFemale, status: "active", ...stamp });
  const validPair = key("valid-pair"); await seedPair(validPair, validMale, validFemale); await assert.doesNotReject(activatePair(db, { pairId: validPair, activeOn: "2026-02-01" }));

  const parent = key("parent"); const child = key("child"); const mother = key("mother"); const lineagePair = key("lineage");
  for (const [birdId, sex] of [[parent, "male"], [mother, "female"]] as const) { await db.collection("birds").doc(birdId).set({ ringId: key(`${birdId}-ring`), origin: "external", displayName: birdId, status: "active", ...stamp }); await db.collection("sexHistory").doc(key(`${birdId}-sex`)).set({ birdId, sex, determinedOn: "2026-01-01", method: "dna", ...stamp }); }
  await db.collection("pairs").doc(lineagePair).set({ status: "active", startedOn: "2026-01-01", ...stamp }); await db.collection("pairMembers").doc(key("lineage-m")).set({ pairId: lineagePair, birdId: parent, role: "male", effectiveFrom: "2026-01-01", ...stamp }); await db.collection("pairMembers").doc(key("lineage-f")).set({ pairId: lineagePair, birdId: mother, role: "female", effectiveFrom: "2026-01-01", ...stamp });
  const cycleId = key("lineage-cycle"); const eggId = key("lineage-egg"); await db.collection("breedingCycles").doc(cycleId).set({ pairId: lineagePair, startedOn: "2026-01-01", status: "active", ...stamp }); await db.collection("eggs").doc(eggId).set({ cycleId, sequenceNo: 1, laidOn: "2026-01-02", status: "hatched", ...stamp }); await db.collection("birds").doc(child).set({ ringId: key("child-ring"), origin: "farm_hatched", eggId, displayName: child, status: "active", ...stamp }); await db.collection("sexHistory").doc(key("child-sex")).set({ birdId: child, sex: "female", determinedOn: "2026-01-01", method: "dna", ...stamp });
  const blockedPair = key("blocked-pair"); await seedPair(blockedPair, parent, child); await rejects(activatePair(db, { pairId: blockedPair, activeOn: "2026-02-01" }));

  const sibling = key("sibling"); const siblingEgg = key("sibling-egg"); await db.collection("eggs").doc(siblingEgg).set({ cycleId, sequenceNo: 2, laidOn: "2026-01-03", status: "hatched", ...stamp }); await db.collection("birds").doc(sibling).set({ ringId: key("sibling-ring"), origin: "farm_hatched", eggId: siblingEgg, displayName: sibling, status: "active", ...stamp }); await db.collection("sexHistory").doc(key("sibling-sex")).set({ birdId: sibling, sex: "male", determinedOn: "2026-01-01", method: "dna", ...stamp });
  const siblingPair = key("sibling-pair"); await seedPair(siblingPair, sibling, child); await rejects(activatePair(db, { pairId: siblingPair, activeOn: "2026-02-01" }));
});
