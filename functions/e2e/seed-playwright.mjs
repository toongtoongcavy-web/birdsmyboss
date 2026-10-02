import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const projectId = "birdsmyboss-v1-dev";
const authBase = "http://127.0.0.1:9099";
const firestoreBase = "http://127.0.0.1:8080";
const operator = {
  email: "playwright-operator@example.test",
  password: "playwright-emulator-only",
};

const clearFirestore = await fetch(`${firestoreBase}/emulator/v1/projects/${projectId}/databases/(default)/documents`, { method: "DELETE" });
if (!clearFirestore.ok) throw new Error(`Unable to reset Firestore Emulator: ${clearFirestore.status}`);
const clearAuth = await fetch(`${authBase}/emulator/v1/projects/${projectId}/accounts`, { method: "DELETE" });
if (!clearAuth.ok) throw new Error(`Unable to reset Auth Emulator: ${clearAuth.status}`);

const response = await fetch(`${authBase}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=emulator-only`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ ...operator, returnSecureToken: true }),
});
if (!response.ok) throw new Error(`Unable to create Playwright operator: ${response.status}`);
const account = await response.json();
if (!account.localId) throw new Error("Auth Emulator did not return a localId for the Playwright operator.");

await getAuth(initializeApp({ projectId })).setCustomUserClaims(account.localId, { operator: true });
console.log(`Seeded isolated Playwright operator ${operator.email}.`);
