import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const response = await fetch("http://127.0.0.1:5000/passport/test-token");
assert.equal(response.status, 200);
assert.equal(await response.text(), await readFile(new URL("./dist/index.html", import.meta.url), "utf8"));
console.log("Public Passport SPA route serves the production index.html");
