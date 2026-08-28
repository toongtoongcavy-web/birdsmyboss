import { HttpsError } from "firebase-functions/v2/https";

export const fail = (code: "invalid-argument" | "failed-precondition" | "already-exists" | "not-found" | "permission-denied", message: string): never => {
  throw new HttpsError(code, message);
};
