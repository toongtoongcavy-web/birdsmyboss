type FirebaseEnvironment = Record<string, string | boolean | undefined>;

const required = (environment: FirebaseEnvironment, name: string) => {
  const value = environment[name];
  if (typeof value !== "string" || !value.trim()) throw new Error(`Missing required Firebase configuration: ${name}`);
  return value.trim();
};

export const createFirebaseClientConfig = (environment: FirebaseEnvironment) => {
  const useFirebaseEmulators = environment.VITE_USE_FIREBASE_EMULATORS === "true";
  if (useFirebaseEmulators) return {
    useFirebaseEmulators,
    config: {
      projectId: typeof environment.VITE_FIREBASE_PROJECT_ID === "string" && environment.VITE_FIREBASE_PROJECT_ID.trim() ? environment.VITE_FIREBASE_PROJECT_ID.trim() : "birdsmyboss-v1-dev",
      apiKey: "emulator-only",
    },
  };
  return { useFirebaseEmulators, config: {
    apiKey: required(environment, "VITE_FIREBASE_API_KEY"),
    authDomain: required(environment, "VITE_FIREBASE_AUTH_DOMAIN"),
    projectId: required(environment, "VITE_FIREBASE_PROJECT_ID"),
    storageBucket: required(environment, "VITE_FIREBASE_STORAGE_BUCKET"),
    messagingSenderId: required(environment, "VITE_FIREBASE_MESSAGING_SENDER_ID"),
    appId: required(environment, "VITE_FIREBASE_APP_ID"),
  } };
};
