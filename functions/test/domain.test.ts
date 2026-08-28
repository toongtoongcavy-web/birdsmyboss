import assert from "node:assert/strict";
import test from "node:test";
import { classifyKinship } from "../src/domain/kinship.js";
import { currentMembersAt, validatePairMembers } from "../src/domain/pair.js";
import { assertNoCanonicalParentageInput, intervalsOverlap, normalizeRingId } from "../src/domain/validation.js";

test("ring normalization makes GC-001 and gc-001 identical but preserves separators", () => {
  assert.equal(normalizeRingId(" GC-001 "), "GC-001");
  assert.equal(normalizeRingId("gc-001"), "GC-001");
  assert.notEqual(normalizeRingId("GC-001"), normalizeRingId("GC 001"));
  assert.notEqual(normalizeRingId("GC-001"), normalizeRingId("GC001"));
});

test("active pair requires exactly one evidence-backed male and female", () => {
  const members = currentMembersAt([{ birdId: "m", role: "male", effectiveFrom: "2026-01-01" }, { birdId: "f", role: "female", effectiveFrom: "2026-01-01" }], "2026-02-01");
  assert.deepEqual(validatePairMembers(members, new Map([["m", "male"], ["f", "female"]])), { maleId: "m", femaleId: "f" });
  assert.throws(() => validatePairMembers(members, new Map([["m", "female"], ["f", "female"]])));
});

test("kinship policy blocks parent offspring and siblings, reports unknown without pedigree", () => {
  assert.deepEqual(classifyKinship("parent", "child", (id) => id === "child" ? ["parent"] : []), { status: "blocked", reason: "parent_offspring" });
  assert.deepEqual(classifyKinship("a", "b", () => ["shared"]), { status: "blocked", reason: "siblings" });
  assert.deepEqual(classifyKinship("a", "b", () => undefined), { status: "unknown" });
});

test("cage and pair intervals reject overlap while allowing historical non-overlap", () => {
  assert.equal(intervalsOverlap("2026-01-01", undefined, "2026-02-01", undefined), true);
  assert.equal(intervalsOverlap("2026-01-01", "2026-01-31", "2026-02-01", undefined), false);
});

test("canonical parentage fields cannot be accepted for bird writes", () => {
  assert.throws(() => assertNoCanonicalParentageInput({ fatherId: "legacy" }));
  assert.throws(() => assertNoCanonicalParentageInput({ motherId: "legacy" }));
  assert.doesNotThrow(() => assertNoCanonicalParentageInput({ eggId: "egg" }));
});
