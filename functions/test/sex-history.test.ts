import assert from "node:assert/strict";
import test from "node:test";
import { orderedSexHistory, resolveCurrentSex, SexHistoryEntry } from "../src/domain/sex-history.js";

const entry = (sexHistoryId: string, sex: string, determinedOn: string, createdAt?: Date, updatedAt?: Date): SexHistoryEntry => ({ sexHistoryId, sex, determinedOn, ...(createdAt ? { createdAt } : {}), ...(updatedAt ? { updatedAt } : {}) });

test("current Sex uses date, creation, update, and document ID descending deterministically", () => {
  assert.equal(resolveCurrentSex([entry("older", "female", "2026-01-01", new Date("2026-01-02T00:00:00Z")), entry("newer", "male", "2026-02-01", new Date("2026-01-01T00:00:00Z"))]), "male");
  assert.equal(resolveCurrentSex([entry("early", "male", "2026-03-01", new Date("2026-03-01T09:20:00Z")), entry("late", "female", "2026-03-01", new Date("2026-03-01T09:25:00Z"))]), "female");
  assert.equal(resolveCurrentSex([entry("updated-early", "male", "2026-03-02", undefined, new Date("2026-03-02T09:20:00Z")), entry("updated-late", "female", "2026-03-02", undefined, new Date("2026-03-02T09:25:00Z"))]), "female");
  assert.deepEqual(orderedSexHistory([entry("legacy-a", "male", "2026-04-01"), entry("legacy-b", "female", "2026-04-01")]).map(row => row.sexHistoryId), ["legacy-b", "legacy-a"]);
  assert.equal(resolveCurrentSex([entry("known", "female", "2026-04-01"), entry("unknown", "unknown", "2026-05-01")]), "female");
});
