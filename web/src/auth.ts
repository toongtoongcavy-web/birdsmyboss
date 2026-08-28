import { getIdTokenResult, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import { auth } from "./firebase";

export type OperatorIdentity = Pick<User, "uid" | "displayName" | "email"> & { isOperator: boolean };
export const observeOperator = (listener: (user: OperatorIdentity | null) => void) => onAuthStateChanged(auth, async (user) => {
  if (!user) { listener(null); return; }
  const token = await getIdTokenResult(user);
  listener({ uid: user.uid, displayName: user.displayName, email: user.email, isOperator: token.claims.operator === true });
});
export const signInOperatorWithGoogle = () => signInWithPopup(auth, new GoogleAuthProvider());
export const signOutOperator = () => signOut(auth);
