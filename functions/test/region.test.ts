import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const repositoryPath = (...segments: string[]) => path.resolve(__dirname, "../../..", ...segments);

test("Production Functions use the locked Singapore region globally", () => {
  const source = readFileSync(repositoryPath("functions", "src", "index.ts"), "utf8");

  assert.match(source, /import \{ setGlobalOptions \} from "firebase-functions\/v2";/);
  assert.match(source, /setGlobalOptions\(\{ region: "asia-southeast1", minInstances: 0, maxInstances: 2, concurrency: 10 \}\);/);
});

test("operator Functions inherit the owner-only runtime capacity limits", () => {
  const source = readFileSync(repositoryPath("functions", "src", "index.ts"), "utf8");

  assert.match(source, /setGlobalOptions\(\{ region: "asia-southeast1", minInstances: 0, maxInstances: 2, concurrency: 10 \}\);/);
  assert.match(source, /const operatorOnly = <T>\(handler: \(data: T\) => Promise<unknown>\) => onCall\(async/);
});

test("public Passport and public Photo endpoints have tighter explicit limits", () => {
  const source = readFileSync(repositoryPath("functions", "src", "index.ts"), "utf8");

  assert.match(source, /getBirdPassport = onCall\(\{ secrets: \[publicMediaKey\], minInstances: 0, maxInstances: 1, concurrency: 10, timeoutSeconds: 20 \}/);
  assert.match(source, /servePublicPhoto = onRequest\(\{ secrets: \[publicMediaKey\], minInstances: 0, maxInstances: 1, concurrency: 2, timeoutSeconds: 30 \}/);
  assert.match(source, /"Cache-Control": "no-store"/);
});

test("the web callable client explicitly uses the locked Singapore region", () => {
  const source = readFileSync(repositoryPath("web", "src", "functions.ts"), "utf8");

  assert.match(source, /getFunctions\(app, "asia-southeast1"\)/);
  assert.doesNotMatch(source, /getFunctions\(app\);/);
});
