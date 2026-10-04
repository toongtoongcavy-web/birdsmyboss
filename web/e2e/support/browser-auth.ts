import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { auth, ensureLocalAuth } from "../../src/firebase";

export async function signInPlaywrightOperator() {
  await ensureLocalAuth();
  if (auth.currentUser) await signOut(auth);
  await signInWithEmailAndPassword(auth, "playwright-operator@example.test", "playwright-emulator-only");
}
