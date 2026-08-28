import assert from "node:assert/strict";
import test from "node:test";
import { Firestore } from "firebase-admin/firestore";
import { activatePair, createExternalBird } from "../src/services/firestore.js";
import { createPair, recordSexHistory } from "../src/services/phase5c.js";

const db = new Firestore({ projectId: "birdsmyboss-v1-dev" });
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const ring = (name: string) => `EXT-${name}-${suffix}`;
const rejects = (input: Record<string, unknown>) => assert.rejects(createExternalBird(db, input));

test("external and purchased birds use canonical fields and normalized unique rings", async () => {
  const external = await createExternalBird(db, { ringId: ` ${ring("one").toLowerCase()} `, displayName: "Foundation male", origin: "external", mutation: "Blue", hatchedOn: "2026-01-01" });
  assert.equal(external.ringId, ring("ONE").toUpperCase());
  const stored = (await db.collection("birds").doc(external.birdId).get()).data()!;
  assert.equal(stored.status, "active"); assert.equal(stored.passportStatus, "draft");
  for (const key of ["eggId", "fatherId", "motherId"]) assert.equal(key in stored, false);
  await assert.doesNotReject(createExternalBird(db, { ringId: ring("purchased"), displayName: "Purchased", origin: "purchased" }));
  await assert.rejects(createExternalBird(db, { ringId: external.ringId.toLowerCase(), displayName: "Duplicate", origin: "external" }));
});

test("invalid lineage inputs and farm_hatched origin reject", async () => {
  const base = { ringId: ring("invalid"), displayName: "Invalid", origin: "external" };
  await rejects({ ...base, origin: "farm_hatched" });
  await rejects({ ...base, eggId: "egg" });
  await rejects({ ...base, fatherId: "father" });
  await rejects({ ...base, motherId: "mother" });
});

test("foundation birds accept sex history and participate in pair activation with unknown kinship", async () => {
  const male = await createExternalBird(db, { ringId: ring("male"), displayName: "Male", origin: "external" });
  const female = await createExternalBird(db, { ringId: ring("female"), displayName: "Female", origin: "unknown" });
  await recordSexHistory(db, { birdId: male.birdId, sex: "male", method: "dna", determinedOn: "2026-01-01" });
  await recordSexHistory(db, { birdId: female.birdId, sex: "female", method: "dna", determinedOn: "2026-01-01" });
  const { pairId } = await createPair(db, { maleBirdId: male.birdId, femaleBirdId: female.birdId, startedOn: "2026-01-01" });
  const activated = await activatePair(db, { pairId, activeOn: "2026-01-01" });
  assert.deepEqual(activated.kinship, { status: "unknown" });
});
