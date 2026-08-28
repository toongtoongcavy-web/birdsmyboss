import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

test("canonical V1 schema is present and declares the locked collection set", () => {
  const schemaPath = path.resolve(
    __dirname,
    "../../../schema/firestore-schema-v1.json",
  );
  assert.equal(existsSync(schemaPath), true);

  const schema = JSON.parse(readFileSync(schemaPath, "utf8")) as {
    collections: Record<string, unknown>;
  };
  const expectedCollections = [
    "cages",
    "pairs",
    "pairMembers",
    "cageAssignments",
    "breedingCycles",
    "eggs",
    "birds",
    "photos",
    "weightHistory",
    "sexHistory",
    "documents",
    "priceHistory",
    "customers",
    "sales",
    "reservations",
    "payments",
    "refunds",
    "giveaways",
    "deliveries",
    "handovers",
    "saleTimeline",
  ];

  assert.deepEqual(Object.keys(schema.collections).sort(), expectedCollections.sort());
});
