import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, signInAnonymously } from "firebase/auth";
import { connectStorageEmulator, getStorage } from "firebase/storage";
import { createFirebaseClientConfig } from "./firebaseConfig";

const client = createFirebaseClientConfig(import.meta.env);
export const app = initializeApp(client.config);

export const auth = getAuth(app);
export const storage = getStorage(app);
export const useFirebaseEmulators = import.meta.env.VITE_USE_FIREBASE_EMULATORS === "true";

let localAuthReady: Promise<void> = Promise.resolve();
if (useFirebaseEmulators) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectStorageEmulator(storage, "127.0.0.1", 9199);
  localAuthReady = signInAnonymously(auth).then(() => undefined);
}

export const ensureLocalAuth = () => localAuthReady;
