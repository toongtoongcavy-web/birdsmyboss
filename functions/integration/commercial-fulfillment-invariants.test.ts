import assert from "node:assert/strict";
import test from "node:test";
import { Firestore } from "firebase-admin/firestore";
import { assignBirdToCageMvp, createActivePairInCageMvp, createMvpCage, listMvpBirds, listMvpCages } from "../src/services/mvp-cages.js";

const db = new Firestore({ projectId: "birdsmyboss-v1-dev" });
const prefix = `invariants-${Date.now()}-${Math.random().toString(36).slice(2)}`;
let sequence = 0;
const key = (name: string) => `${prefix}-${name}-${sequence++}`;

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
