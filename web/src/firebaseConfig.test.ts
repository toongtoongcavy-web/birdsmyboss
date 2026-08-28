import { describe, expect, it } from "vitest";
import { createFirebaseClientConfig } from "./firebaseConfig";

describe("Firebase client configuration", () => {
  it("fails clearly when deployed configuration is missing", () => {
    expect(() => createFirebaseClientConfig({})).toThrow("VITE_FIREBASE_API_KEY");
  });
  it("requires the complete deployed web configuration", () => {
    const environment = { VITE_FIREBASE_API_KEY: "api", VITE_FIREBASE_AUTH_DOMAIN: "auth.example.test", VITE_FIREBASE_PROJECT_ID: "project", VITE_FIREBASE_STORAGE_BUCKET: "bucket", VITE_FIREBASE_MESSAGING_SENDER_ID: "sender", VITE_FIREBASE_APP_ID: "app" };
    expect(createFirebaseClientConfig(environment)).toEqual({ useFirebaseEmulators: false, config: { apiKey: "api", authDomain: "auth.example.test", projectId: "project", storageBucket: "bucket", messagingSenderId: "sender", appId: "app" } });
  });
  it("uses isolated emulator configuration only when explicitly enabled", () => {
    expect(createFirebaseClientConfig({ VITE_USE_FIREBASE_EMULATORS: "true" })).toEqual({ useFirebaseEmulators: true, config: { projectId: "birdsmyboss-v1-dev", apiKey: "emulator-only" } });
  });
});
