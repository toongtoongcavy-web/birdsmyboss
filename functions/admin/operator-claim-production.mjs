import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const productionProject = "birdsmyboss-v1-prod";
const args = Object.fromEntries(process.argv.slice(2).map((value, index, values) => value.startsWith("--") ? [value.slice(2), values[index + 1]] : null).filter(Boolean));

if (args.project !== productionProject) throw new Error(`Refusing to run: --project must be exactly ${productionProject}.`);
if (!args.uid || typeof args.uid !== "string") throw new Error("Refusing to run: an explicit --uid is required.");
if (args.confirm !== "SET_OPERATOR_TRUE") throw new Error("Refusing to run: pass --confirm SET_OPERATOR_TRUE after verifying the target project and UID.");

console.log(JSON.stringify({ action: "set operator=true", projectId: productionProject, uid: args.uid, confirmation: "accepted" }));
initializeApp({ credential: applicationDefault(), projectId: productionProject });
const auth = getAuth();
const user = await auth.getUser(args.uid);
await auth.setCustomUserClaims(args.uid, { ...user.customClaims, operator: true });
const verified = await auth.getUser(args.uid);
console.log(JSON.stringify({ projectId: productionProject, uid: args.uid, operator: verified.customClaims?.operator === true }));
