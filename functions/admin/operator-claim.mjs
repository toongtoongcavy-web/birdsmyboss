import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const args = Object.fromEntries(process.argv.slice(2).map((value, index, values) => value.startsWith("--") ? [value.slice(2), values[index + 1]] : null).filter(Boolean));
const expectedProject = "birdsmyboss-v1-dev";
if (args.project !== expectedProject) throw new Error(`Refusing to run: --project must be exactly ${expectedProject}.`);
if (!args.uid || typeof args.uid !== "string") throw new Error("Refusing to run: an explicit --uid is required.");
if (!['true', 'false'].includes(args.operator)) throw new Error("Refusing to run: --operator must be true or false.");

initializeApp({ credential: applicationDefault(), projectId: expectedProject });
const auth = getAuth();
const user = await auth.getUser(args.uid);
const claims = { ...user.customClaims };
if (args.operator === "true") claims.operator = true;
else delete claims.operator;
await auth.setCustomUserClaims(args.uid, claims);
const verified = await auth.getUser(args.uid);
console.log(JSON.stringify({ projectId: expectedProject, uid: args.uid, operator: verified.customClaims?.operator === true }));
