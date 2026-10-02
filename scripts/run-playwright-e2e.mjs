import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const firebase = fileURLToPath(new URL("../node_modules/firebase-tools/lib/bin/firebase.js", import.meta.url));
const result = spawnSync(process.execPath, [firebase,
  "emulators:exec",
  "--project", "birdsmyboss-v1-dev",
  "--only", "auth,firestore,functions",
  "node functions/e2e/seed-playwright.mjs && npm --prefix web run test:e2e",
], {
  cwd: new URL("..", import.meta.url),
  env: { ...process.env, FUNCTIONS_DISCOVERY_TIMEOUT: "30000" },
  stdio: "inherit",
});

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
