import assert from "node:assert/strict";
import test from "node:test";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { Firestore } from "firebase-admin/firestore";

const projectId = "birdsmyboss-v1-dev";
const bucket = "birdsmyboss-v1-dev.firebasestorage.app";
const storageBase = `http://127.0.0.1:9199/v0/b/${bucket}/o`;
const authBase = "http://127.0.0.1:9099";
const app = initializeApp({ projectId }, "storage-rules");
const auth = getAuth(app);
const db = new Firestore({ projectId });
const suffix = `storage-rules-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const createToken = async (operator: boolean) => {
  const response = await fetch(`${authBase}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=development-only`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: `${suffix}-${Math.random().toString(36).slice(2)}@example.test`, password: "emulator-test-only", returnSecureToken: true }), signal: AbortSignal.timeout(5000),
  });
  assert.equal(response.ok, true);
  const body = await response.json() as { idToken: string; localId: string; refreshToken: string };
  await auth.setCustomUserClaims(body.localId, { operator });
  const refreshed = await fetch(`${authBase}/securetoken.googleapis.com/v1/token?key=development-only`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: body.refreshToken }), signal: AbortSignal.timeout(5000),
  });
  assert.equal(refreshed.ok, true);
  return String((await refreshed.json() as { id_token: string }).id_token);
};

const upload = (path: string, token?: string, contentType = "image/png", body = Buffer.from([137, 80, 78, 71])) => fetch(`${storageBase}?uploadType=media&name=${encodeURIComponent(path)}`, {
  method: "POST",
  headers: { "content-type": contentType, ...(token ? { authorization: `Bearer ${token}` } : {}) },
  body, signal: AbortSignal.timeout(5000),
});

const createPendingIntake = async (id: string, birdId: string, assetKind = "photos", contentType = "image/png", size = 4) => {
  const extension = contentType === "application/pdf" ? "pdf" : "png";
  const path = `bird-assets/${birdId}/${assetKind}/${id}/asset.${extension}`;
  await db.collection("assetIntakes").doc(id).set({
    birdId,
    assetKind,
    storagePath: path,
    declaredContentType: contentType,
    declaredSize: size,
    status: "pending",
  });
  return path;
};

test("Storage Rules enforce pending operator-only Bird asset intake", async () => {
  const operator = await createToken(true);
  const nonOperator = await createToken(false);
  const intakeId = `${suffix}-approved`;
  const approvedPath = await createPendingIntake(intakeId, `${suffix}-bird-a`);

  assert.equal((await upload(approvedPath)).ok, false, "unauthenticated upload is rejected");
  assert.equal((await upload(approvedPath, nonOperator)).ok, false, "authenticated non-operator upload is rejected");
  assert.equal((await upload(approvedPath, operator)).ok, true, "operator upload to pending intake succeeds");
  assert.equal((await upload(`arbitrary/${suffix}.png`, operator)).ok, false, "operator arbitrary path is rejected");

  const otherIntake = `${suffix}-bird-b`;
  await createPendingIntake(otherIntake, `${suffix}-bird-b`);
  assert.equal((await upload(`bird-assets/${suffix}-bird-a/photos/${otherIntake}/asset.png`, operator)).ok, false, "cross-Bird namespace upload is rejected");
  assert.equal((await upload(approvedPath, operator)).ok, false, "overwrite is rejected");
  assert.equal((await fetch(`${storageBase}/${encodeURIComponent(approvedPath)}`, { method: "DELETE", headers: { authorization: `Bearer ${operator}` }, signal: AbortSignal.timeout(5000) })).ok, false, "delete is rejected");
  assert.equal((await fetch(`${storageBase}/${encodeURIComponent(approvedPath)}?alt=media`, { signal: AbortSignal.timeout(5000) })).ok, false, "direct public read is rejected");

  const wrongTypeId = `${suffix}-wrong-type`, wrongTypePath = await createPendingIntake(wrongTypeId, `${suffix}-type`);
  assert.equal((await upload(wrongTypePath, operator, "image/jpeg")).ok, false, "mismatched content type is rejected");
  const wrongSizeId = `${suffix}-wrong-size`, wrongSizePath = await createPendingIntake(wrongSizeId, `${suffix}-size`);
  assert.equal((await upload(wrongSizePath, operator, "image/png", Buffer.from([1, 2, 3]))).ok, false, "mismatched size is rejected");
  const documentId = `${suffix}-document`, documentPath = await createPendingIntake(documentId, `${suffix}-document-bird`, "documents", "application/pdf", 4);
  assert.equal((await upload(documentPath, operator, "application/pdf", Buffer.from([37, 80, 68, 70]))).ok, true, "operator document upload to pending intake succeeds");
});
