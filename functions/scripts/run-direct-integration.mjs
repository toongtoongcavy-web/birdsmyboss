import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const integrationDir = fileURLToPath(new URL("../lib/integration/", import.meta.url));
const callableSuites = new Set(["callable-auth-smoke.test.js", "phase6-e2e.test.js"]);
const testFiles = readdirSync(integrationDir)
  .filter((name) => name.endsWith(".test.js") && !callableSuites.has(name))
  .sort()
  .map((name) => fileURLToPath(new URL(`../lib/integration/${name}`, import.meta.url)));

if (testFiles.length === 0) throw new Error("No direct integration suites were discovered.");

console.log(`Running ${testFiles.length} direct integration suites:`);
for (const file of testFiles) console.log(`- ${file.split(/[\\/]/).at(-1)}`);

const result = spawnSync(process.execPath, ["--test", "--test-concurrency=1", ...testFiles], {
  stdio: "inherit",
});

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
