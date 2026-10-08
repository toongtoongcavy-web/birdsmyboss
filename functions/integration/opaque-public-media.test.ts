import assert from "node:assert/strict";
import test from "node:test";
import { Firestore } from "firebase-admin/firestore";
import { createOpaquePhotoHandle, createOperatorPhotoHandle, isSupportedPublicPhotoContentType, opaquePhotoUrl, operatorPhotoUrl, publicPhotoHandleTtlMs, resolveEligibleOperatorPhoto, resolveEligiblePublicPhoto } from "../src/services/public-media.js";
import { resolvePassport, rotatePassportToken } from "../src/services/phase4.js";
import { getBirdDetails } from "../src/services/reads.js";

const db = new Firestore({ projectId: "birdsmyboss-v1-dev" });
const key = Buffer.alloc(32, 19).toString("base64url");
let serial = 0;
const id = (prefix: string) => `${prefix}-${Date.now()}-${serial++}`;
const stamp = { createdAt: new Date(), updatedAt: new Date() };

const seed = async () => {
  const birdId = id("bird"), photoId = id("photo"), token = id("passport-token");
  await db.collection("birds").doc(birdId).set({ ringId: id("ring"), displayName: "Opaque media bird", origin: "external", status: "active", passportStatus: "published", publicToken: token, ...stamp });
  await db.collection("photos").doc(photoId).set({ ownerType: "BIRD", ownerId: birdId, storagePath: `bird-assets/${birdId}/photos/${photoId}/asset.jpg`, status: "active", managedStorage: true, isPublicOnPassport: true, ...stamp });
  return { birdId, photoId, token };
};

test("opaque Passport Photo URLs contain no canonical identifiers or Passport token", async () => {
  const { birdId, photoId, token } = await seed();
  const handle = createOpaquePhotoHandle(key, birdId, photoId, token);
  const url = opaquePhotoUrl(handle);
  assert.match(url, /^\/public-media\/v1\/v1\./);
  for (const privateValue of [birdId, photoId, token, "bird-assets"]) assert.equal(url.includes(privateValue), false);
  const passport = await resolvePassport(db, token, key);
  assert.equal(passport?.photos.length, 1);
  assert.equal(passport?.photos[0]?.publicUrl.includes("bird-assets"), false);
  assert.equal(passport?.photos[0]?.publicUrl.includes(token), false);
  await db.collection("documents").doc(id("document")).set({ ownerType: "BIRD", ownerId: birdId, documentType: "DNA", issuedOn: "2026-08-23", status: "active", managedStorage: true, isPublicOnPassport: true, storagePath: "bird-assets/private/document.pdf", ...stamp });
  const withDocument = await resolvePassport(db, token, key);
  assert.deepEqual(Object.keys(withDocument?.documents[0] ?? {}).sort(), ["documentType", "issuedOn"]);
  assert.equal(JSON.stringify(withDocument?.documents).includes("publicUrl"), false);
});

test("only verified supported image MIME types are eligible for public streaming", () => {
  assert.equal(isSupportedPublicPhotoContentType("image/jpeg"), true);
  assert.equal(isSupportedPublicPhotoContentType("image/png"), true);
  assert.equal(isSupportedPublicPhotoContentType("image/webp"), true);
  assert.equal(isSupportedPublicPhotoContentType("image/svg+xml"), false);
  assert.equal(isSupportedPublicPhotoContentType("application/pdf"), false);
});

test("opaque handles authorize only active published current public Photos", async () => {
  const { birdId, photoId, token } = await seed();
  const handle = createOpaquePhotoHandle(key, birdId, photoId, token);
  assert.ok(await resolveEligiblePublicPhoto(db, key, handle));
  assert.equal(await resolveEligiblePublicPhoto(db, key, `${handle}tampered`), null);
  assert.equal(await resolveEligiblePublicPhoto(db, key, createOpaquePhotoHandle(key, birdId, photoId, token, Date.now() - publicPhotoHandleTtlMs - 1)), null);
  await db.collection("photos").doc(photoId).update({ status: "archived" });
  assert.equal(await resolveEligiblePublicPhoto(db, key, handle), null);
  await db.collection("photos").doc(photoId).update({ status: "active", isPublicOnPassport: false });
  assert.equal(await resolveEligiblePublicPhoto(db, key, handle), null);
  await db.collection("photos").doc(photoId).update({ isPublicOnPassport: true, managedStorage: false });
  assert.equal(await resolveEligiblePublicPhoto(db, key, handle), null);
  await db.collection("photos").doc(photoId).update({ managedStorage: true });
  await db.collection("birds").doc(birdId).update({ passportStatus: "disabled" });
  assert.equal(await resolveEligiblePublicPhoto(db, key, handle), null);
  await db.collection("birds").doc(birdId).update({ passportStatus: "draft" });
  assert.equal(await resolveEligiblePublicPhoto(db, key, handle), null);
});

test("token rotation and cross-Bird references invalidate opaque handles", async () => {
  const { birdId, photoId, token } = await seed();
  const handle = createOpaquePhotoHandle(key, birdId, photoId, token);
  await rotatePassportToken(db, { birdId });
  assert.equal(await resolveEligiblePublicPhoto(db, key, handle), null);
  const otherBirdId = id("other-bird");
  await db.collection("birds").doc(otherBirdId).set({ ringId: id("other-ring"), displayName: "Other", origin: "external", status: "active", passportStatus: "published", publicToken: id("other-token"), ...stamp });
  await db.collection("photos").doc(photoId).update({ ownerId: otherBirdId });
  const forgedCurrent = createOpaquePhotoHandle(key, birdId, photoId, String((await db.collection("birds").doc(birdId).get()).data()?.publicToken));
  assert.equal(await resolveEligiblePublicPhoto(db, key, forgedCurrent), null);
});

test("internal Bird Profile selects a deterministic active private Photo without changing public visibility", async () => {
  const birdId = id("internal-bird"), token = id("internal-token");
  const preferredId = id("preferred-photo"), laterId = id("later-photo"), archivedId = id("archived-photo");
  await db.collection("birds").doc(birdId).set({ ringId: id("ring"), displayName: "Internal portrait", origin: "external", status: "active", passportStatus: "published", publicToken: token, ...stamp });
  await db.collection("photos").doc(preferredId).set({ ownerType: "BIRD", ownerId: birdId, storagePath: `bird-assets/${birdId}/photos/${preferredId}/asset.jpg`, status: "active", managedStorage: true, isPublicOnPassport: false, sortOrder: 1, caption: "Preferred", createdAt: new Date("2026-01-02T00:00:00Z"), updatedAt: new Date() });
  await db.collection("photos").doc(laterId).set({ ownerType: "BIRD", ownerId: birdId, storagePath: `bird-assets/${birdId}/photos/${laterId}/asset.jpg`, status: "active", managedStorage: true, isPublicOnPassport: false, sortOrder: 2, createdAt: new Date("2026-01-01T00:00:00Z"), updatedAt: new Date() });
  await db.collection("photos").doc(archivedId).set({ ownerType: "BIRD", ownerId: birdId, storagePath: `bird-assets/${birdId}/photos/${archivedId}/asset.jpg`, status: "archived", managedStorage: true, isPublicOnPassport: true, sortOrder: 0, createdAt: new Date("2025-01-01T00:00:00Z"), updatedAt: new Date() });

  const privateDetail = await getBirdDetails(db, { birdId }, key);
  assert.equal(privateDetail.portraitPhoto?.photoId, preferredId);
  assert.equal(privateDetail.portraitPhoto?.caption, "Preferred");
  assert.match(String(privateDetail.portraitPhoto?.readUrl), /^\/operator-media\/v1\/op1\./);
  for (const privateValue of [birdId, preferredId, "bird-assets"]) assert.equal(String(privateDetail.portraitPhoto?.readUrl).includes(privateValue), false);
  const operatorHandle = String(privateDetail.portraitPhoto?.readUrl).split("/").at(-1)!;
  assert.ok(await resolveEligibleOperatorPhoto(db, key, operatorHandle));
  assert.equal((await resolvePassport(db, token, key))?.photos.length, 0);

  await db.collection("photos").doc(preferredId).update({ isPublicOnPassport: true });
  assert.equal((await resolvePassport(db, token, key))?.photos.length, 1);
  await db.collection("photos").doc(preferredId).update({ isPublicOnPassport: false });
  assert.equal((await resolvePassport(db, token, key))?.photos.length, 0);
  assert.equal((await getBirdDetails(db, { birdId }, key)).portraitPhoto?.photoId, preferredId);

  await db.collection("photos").doc(preferredId).update({ status: "archived" });
  assert.equal(await resolveEligibleOperatorPhoto(db, key, operatorHandle), null);
  assert.equal((await getBirdDetails(db, { birdId }, key)).portraitPhoto?.photoId, laterId);
});

test("operator Photo handles reject missing, tampered, expired, unmanaged and cross-Bird access", async () => {
  const { birdId, photoId } = await seed();
  await db.collection("photos").doc(photoId).update({ isPublicOnPassport: false });
  const handle = createOperatorPhotoHandle(key, birdId, photoId);
  assert.equal(operatorPhotoUrl(handle).includes(birdId), false);
  assert.ok(await resolveEligibleOperatorPhoto(db, key, handle));
  assert.equal(await resolveEligibleOperatorPhoto(db, key, `${handle}tampered`), null);
  assert.equal(await resolveEligibleOperatorPhoto(db, key, createOperatorPhotoHandle(key, birdId, photoId, Date.now() - publicPhotoHandleTtlMs - 1)), null);
  await db.collection("photos").doc(photoId).update({ managedStorage: false });
  assert.equal(await resolveEligibleOperatorPhoto(db, key, handle), null);
  await db.collection("photos").doc(photoId).update({ managedStorage: true, ownerId: id("wrong-bird") });
  assert.equal(await resolveEligibleOperatorPhoto(db, key, handle), null);
});
