import assert from "node:assert/strict";
import test from "node:test";
import { Firestore } from "firebase-admin/firestore";
import { initializeApp } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";
import { archiveBirdDocument, archiveBirdPhoto, beginBirdAssetIntake, finalizeBirdAssetIntake, setPassportPublication, supersedeBirdDocument } from "../src/services/phase5c.js";
import { resolvePassport } from "../src/services/phase4.js";

process.env.BMB_PUBLIC_MEDIA_KEY = Buffer.alloc(32, 7).toString("base64url");

initializeApp({ projectId: "birdsmyboss-v1-dev", storageBucket: "birdsmyboss-v1-dev.firebasestorage.app" });
const db = new Firestore({ projectId: "birdsmyboss-v1-dev" });
const suffix = `asset-${Date.now()}-${Math.random().toString(36).slice(2)}`;
let serial = 0;
const key = () => `${suffix}-${serial++}`;
const seedBird = async () => { const birdId = key(); await db.collection("birds").doc(birdId).set({ ringId: key(), displayName: "Asset Bird", origin: "external", status: "active", passportStatus: "draft" }); return birdId; };
const intakeKey = () => `intake-${key()}-request`;
const upload = async (path: string, body: Buffer, contentType: string) => getStorage().bucket().file(path).save(body, { metadata: { contentType } });
const prepare = async (birdId: string, assetType: "PHOTO" | "DOCUMENT", contentType: string, body: Buffer, extra: Record<string, unknown> = {}) => {
  const intake = await beginBirdAssetIntake(db, { birdId, assetType, intakeId: intakeKey(), contentType, size: body.length, ...extra }) as { intakeId: string; storagePath: string };
  await upload(intake.storagePath, body, contentType);
  return intake;
};

test("asset intake finalizes verified Photos idempotently and rejects missing or invalid objects", async () => {
  const birdId = await seedBird(); const bytes = Buffer.from([1, 2, 3]);
  const intake = await prepare(birdId, "PHOTO", "image/jpeg", bytes, { caption: "portrait" });
  const results = await Promise.all([finalizeBirdAssetIntake(db, { intakeId: intake.intakeId }), finalizeBirdAssetIntake(db, { intakeId: intake.intakeId })]);
  assert.equal(results[0].photoId, results[1].photoId);
  assert.equal((await db.collection("photos").where("ownerId", "==", birdId).get()).size, 1);
  const photoId = String(results[0].photoId);
  await setPassportPublication(db, { targetType: "PHOTO", assetId: photoId, birdId, isPublicOnPassport: true });
  await db.collection("birds").doc(birdId).update({ passportStatus: "published", publicToken: `token-${key()}` });
  const token = String((await db.collection("birds").doc(birdId).get()).data()?.publicToken);
  const passport = await resolvePassport(db, token);
  assert.equal(passport?.photos.length, 1); assert.deepEqual(Object.keys(passport!.photos[0]).sort(), ["caption", "publicUrl", "sortOrder"]);
  await assert.rejects(beginBirdAssetIntake(db, { birdId, assetType: "PHOTO", intakeId: intakeKey(), contentType: "image/gif", size: 1 }));
  await assert.rejects(beginBirdAssetIntake(db, { birdId, assetType: "PHOTO", intakeId: intakeKey(), contentType: "image/png", size: 10 * 1024 * 1024 + 1 }));
  const missing = await beginBirdAssetIntake(db, { birdId, assetType: "PHOTO", intakeId: intakeKey(), contentType: "image/png", size: 1 });
  await assert.rejects(finalizeBirdAssetIntake(db, { intakeId: missing.intakeId }));
});

test("asset lifecycle archives Photos and Documents and supersedes only with a same-Bird active replacement", async () => {
  const birdId = await seedBird(); const bytes = Buffer.from([1, 2, 3, 4]);
  const photoIntake = await prepare(birdId, "PHOTO", "image/png", bytes);
  const photo = await finalizeBirdAssetIntake(db, { intakeId: photoIntake.intakeId });
  await setPassportPublication(db, { targetType: "PHOTO", assetId: photo.photoId, birdId, isPublicOnPassport: true });
  await archiveBirdPhoto(db, { birdId, photoId: photo.photoId });
  await assert.rejects(archiveBirdPhoto(db, { birdId, photoId: photo.photoId }));
  await assert.rejects(setPassportPublication(db, { targetType: "PHOTO", assetId: photo.photoId, birdId, isPublicOnPassport: true }));
  const firstIntake = await prepare(birdId, "DOCUMENT", "application/pdf", bytes, { documentType: "dna", issuedOn: "2026-01-01" });
  const replacementIntake = await prepare(birdId, "DOCUMENT", "application/pdf", bytes, { documentType: "dna", issuedOn: "2026-02-01" });
  const first = await finalizeBirdAssetIntake(db, { intakeId: firstIntake.intakeId }); const replacement = await finalizeBirdAssetIntake(db, { intakeId: replacementIntake.intakeId });
  const firstDocumentId = String(first.documentId), replacementDocumentId = String(replacement.documentId);
  await supersedeBirdDocument(db, { birdId, oldDocumentId: firstDocumentId, replacementDocumentId });
  const old = (await db.collection("documents").doc(firstDocumentId).get()).data()!;
  assert.equal(old.status, "superseded"); assert.equal(old.supersededByDocumentId, replacementDocumentId);
  await assert.rejects(setPassportPublication(db, { targetType: "DOCUMENT", assetId: firstDocumentId, birdId, isPublicOnPassport: true }));
  await archiveBirdDocument(db, { birdId, documentId: replacementDocumentId });
  await assert.rejects(archiveBirdDocument(db, { birdId, documentId: replacementDocumentId }));
});

test("asset intake paths are server controlled and cannot finalize another Bird namespace", async () => {
  const birdA = await seedBird(), birdB = await seedBird(), bytes = Buffer.from([1, 2]);
  const intake = await prepare(birdA, "DOCUMENT", "image/png", bytes, { documentType: "identity", issuedOn: "2026-01-01" });
  await db.collection("assetIntakes").doc(intake.intakeId).update({ birdId: birdB });
  await assert.rejects(finalizeBirdAssetIntake(db, { intakeId: intake.intakeId }));
  const newIntake = await beginBirdAssetIntake(db, { birdId: birdA, assetType: "PHOTO", intakeId: intakeKey(), contentType: "image/webp", size: bytes.length });
  assert.match(String(newIntake.storagePath), new RegExp(`^bird-assets/${birdA}/photos/`));
  assert.doesNotMatch(String(newIntake.storagePath), /\.\.|%2f/i);
});
