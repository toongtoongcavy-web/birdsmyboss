import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const repositoryPath = (...segments: string[]) => path.resolve(__dirname, "../../..", ...segments);

test("Production Functions use the locked Singapore region globally", () => {
  const source = readFileSync(repositoryPath("functions", "src", "index.ts"), "utf8");

  assert.match(source, /import \{ setGlobalOptions \} from "firebase-functions\/v2";/);
  assert.match(source, /setGlobalOptions\(\{ region: "asia-southeast1" \}\);/);
});

test("the web callable client explicitly uses the locked Singapore region", () => {
  const source = readFileSync(repositoryPath("web", "src", "functions.ts"), "utf8");

  assert.match(source, /getFunctions\(app, "asia-southeast1"\)/);
  assert.doesNotMatch(source, /getFunctions\(app\);/);
});
