import assert from "node:assert/strict";
import test from "node:test";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const projectId = "birdsmyboss-v1-dev";
const callableUrl = `http://127.0.0.1:5001/${projectId}/us-central1/getDashboardSummary`;
const authUrl = `http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=development-only`;
const refreshUrl = "http://127.0.0.1:9099/securetoken.googleapis.com/v1/token?key=development-only";
const adminAuth = getAuth(initializeApp({ projectId }));

const callDashboard = (idToken?: string) => fetch(callableUrl, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    ...(idToken ? { authorization: `Bearer ${idToken}` } : {}),
  },
  body: JSON.stringify({ data: {} }),
});

test("callable rejects an unauthenticated request", async () => {
  const response = await callDashboard();
  const body = await response.json() as { error?: { status?: string } };
  assert.equal(response.ok, false);
  assert.equal(body.error?.status, "UNAUTHENTICATED");
});

const createUser = async (operator?: boolean) => {
  const email = `phase6a-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`;
  const authResponse = await fetch(authUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: "phase6a-test-only", returnSecureToken: true }),
  });
  assert.equal(authResponse.ok, true);
  const authBody = await authResponse.json() as { idToken?: string; localId?: string; refreshToken?: string };
  assert.ok(authBody.idToken); assert.ok(authBody.localId); assert.ok(authBody.refreshToken);
  if (operator !== undefined) await adminAuth.setCustomUserClaims(authBody.localId, { operator });
  if (operator === undefined) return authBody.idToken;
  const refreshed = await fetch(refreshUrl, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: authBody.refreshToken }) });
  assert.equal(refreshed.ok, true);
  return String((await refreshed.json() as { id_token?: string }).id_token);
};

test("callable rejects authenticated users without operator permission", async () => {
  for (const operator of [undefined, false]) {
    const response = await callDashboard(await createUser(operator));
    const body = await response.json() as { error?: { status?: string } };
    assert.equal(response.ok, false); assert.equal(body.error?.status, "PERMISSION_DENIED");
  }
});

test("callable accepts an Auth Emulator operator", async () => {
  const idToken = await createUser(true);

  const response = await callDashboard(idToken);
  const body = await response.json() as { result?: Record<string, number> };
  assert.equal(response.ok, true);
  assert.deepEqual(body.result, {
    birds: 0,
    activePairs: 0,
    activeEggs: 0,
    activeReservations: 0,
    pendingDeliveries: 0,
  });
});

test("public Passport remains callable without authentication", async () => {
  const response = await fetch(`http://127.0.0.1:5001/${projectId}/us-central1/getBirdPassport`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ data: { publicToken: "not-published" } }) });
  assert.equal(response.ok, true); assert.deepEqual(await response.json(), { result: null });
});
