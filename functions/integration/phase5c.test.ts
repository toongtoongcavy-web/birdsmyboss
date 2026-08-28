import assert from "node:assert/strict";
import test from "node:test";
import { Firestore } from "firebase-admin/firestore";
import { addBirdDocument, addBirdPhoto, createCage, createEgg, createPair, recordSexHistory, recordWeightHistory, setPassportStatus } from "../src/services/phase5c.js";

const db = new Firestore({ projectId: "birdsmyboss-v1-dev" });
const prefix = `p5c-${Date.now()}-${Math.random().toString(36).slice(2)}`;

test("phase5c retains core trusted writes and rejects the retired arbitrary asset metadata endpoints", async () => {
  const maleBirdId = `${prefix}-male`, femaleBirdId = `${prefix}-female`, cycleId = `${prefix}-cycle`;
  await db.collection("birds").doc(maleBirdId).set({ ringId: maleBirdId, status: "active" });
  await db.collection("birds").doc(femaleBirdId).set({ ringId: femaleBirdId, status: "active" });
  const cage = await createCage(db, { code: prefix, name: "Cage", status: "active" });
  const pair = await createPair(db, { maleBirdId, femaleBirdId, startedOn: "2026-01-01" });
  await db.collection("breedingCycles").doc(cycleId).set({ pairId: pair.pairId, status: "active" });
  await createEgg(db, { cycleId, sequenceNo: 1, laidOn: "2026-01-02" });
  await recordSexHistory(db, { birdId: maleBirdId, sex: "male", determinedOn: "2026-01-01", method: "sex_linked" });
  await recordWeightHistory(db, { birdId: maleBirdId, weightGrams: 85.5, measuredOn: "2026-01-01" });
  await setPassportStatus(db, { birdId: maleBirdId, passportStatus: "published" });
  await assert.rejects(addBirdPhoto(db, { ownerType: "BIRD", ownerId: maleBirdId, storagePath: "arbitrary", publicUrl: "https://example.test/x", status: "active" }));
  await assert.rejects(addBirdDocument(db, { ownerType: "BIRD", ownerId: maleBirdId, storagePath: "arbitrary", documentType: "dna", issuedOn: "2026-01-01", status: "active" }));
  assert.ok(cage.cageId);
});
