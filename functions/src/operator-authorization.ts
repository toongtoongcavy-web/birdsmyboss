import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";

export const requireOperator = (request: Pick<CallableRequest<unknown>, "auth">): void => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Authentication is required.");
  if (request.auth.token.operator !== true) throw new HttpsError("permission-denied", "Operator permission is required.");
};
