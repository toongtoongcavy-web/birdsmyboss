import assert from "node:assert/strict";
import test from "node:test";
import { Firestore } from "firebase-admin/firestore";
import { createBirdFromEgg } from "../src/services/firestore.js";
import { addBirdDocument, addBirdPhoto, setPassportPublication } from "../src/services/phase5c.js";

const db = new Firestore({ projectId: "birdsmyboss-v1-dev" });
const suffix = `contract-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const key = (name: string) => `${name}-${suffix}`;
const stamp = { createdAt: new Date(), updatedAt: new Date() };
let seededEggs = 0;

const seedEgg = async (status: string) => {
  const seed = `${status}-${seededEggs++}`;
  const pairId = key(`pair-${seed}`);
  const cycleId = key(`cycle-${seed}`);
  const eggId = key(`egg-${seed}`);
  await db.collection("pairs").doc(pairId).set({ status: "active", startedOn: "2026-01-01", ...stamp });
  await db.collection("breedingCycles").doc(cycleId).set({ pairId, status: "active", startedOn: "2026-01-01", ...stamp });
  await db.collection("eggs").doc(eggId).set({ cycleId, sequenceNo: 1, laidOn: "2026-01-02", status, ...stamp });
  return eggId;
};

const hatch = (eggId: string, ringId: string) => createBirdFromEgg(db, {
  eggId,
  ringId,
  origin: "farm_hatched",
  displayName: `Bird ${ringId}`,
});

test("farm-hatched bird writes the required canonical contract from a laid egg", async () => {
  const eggId = await seedEgg("laid");
  const result = await hatch(eggId, key("ring-laid"));
  const bird = (await db.collection("birds").doc(result.birdId).get()).data()!;
  assert.equal(bird.ringId, result.ringId);
  assert.equal(bird.origin, "farm_hatched");
  assert.equal(bird.eggId, eggId);
  assert.equal(bird.displayName, `Bird ${key("ring-laid")}`);
  assert.equal(bird.status, "active");
  assert.equal(bird.passportStatus, "draft");
  assert.equal((await db.collection("eggs").doc(eggId).get()).data()?.status, "hatched");
});

test("only pre-hatch laid or fertile eggs can create a bird", async () => {
  await assert.doesNotReject(hatch(await seedEgg("laid"), key("ring-laid-valid")));
  await assert.doesNotReject(hatch(await seedEgg("fertile"), key("ring-fertile-valid")));
  for (const status of ["infertile", "hatched", "lost", "discarded"]) {
    await assert.rejects(hatch(await seedEgg(status), key(`ring-${status}`)));
  }
});

test("egg-to-bird uniqueness remains transactional after hatch eligibility validation", async () => {
  const eggId = await seedEgg("laid");
  const results = await Promise.allSettled([
    hatch(eggId, key("ring-race-a")),
    hatch(eggId, key("ring-race-b")),
  ]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
});

test("retired metadata-only asset writes reject arbitrary paths and URLs", async () => {
  const birdId = key("asset-bird");
  await db.collection("birds").doc(birdId).set({ ringId: key("asset-ring"), origin: "external", displayName: "Asset bird", status: "active", passportStatus: "draft", ...stamp });

  await assert.rejects(addBirdPhoto(db, { ownerType: "BIRD", ownerId: birdId, storagePath: "photo-active", publicUrl: "https://example.test/photo", status: "active" }));
  await assert.rejects(addBirdDocument(db, { ownerType: "BIRD", ownerId: birdId, storagePath: "document-active", documentType: "dna", issuedOn: "2026-01-01", status: "active" }));
});
