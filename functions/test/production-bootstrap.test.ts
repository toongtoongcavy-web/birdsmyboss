import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import test from "node:test";

const script = "admin/operator-claim-production.mjs";

test("Production operator bootstrap is hard-targeted and refuses execution without explicit confirmation", () => {
  const source = readFileSync(script, "utf8");
  assert.match(source, /const productionProject = "birdsmyboss-v1-prod"/);
  assert.match(source, /args\.project !== productionProject/);
  assert.match(source, /args\.confirm !== "SET_OPERATOR_TRUE"/);
  assert.doesNotMatch(source, /@/);

  const result = spawnSync(process.execPath, [script], { encoding: "utf8" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /--project must be exactly birdsmyboss-v1-prod/);
});
