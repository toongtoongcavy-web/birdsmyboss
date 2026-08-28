import assert from "node:assert/strict";
import test from "node:test";
import { attributedFirestore, withOperatorAttribution } from "../src/services/audit.js";

test("trusted operator attribution overrides caller-supplied audit fields for transaction creates and updates", async () => {
  const creates: Record<string, unknown>[] = [];
  const updates: Record<string, unknown>[] = [];
  const transaction = {
    create: (_reference: unknown, data: Record<string, unknown>) => { creates.push(data); return transaction; },
    update: (_reference: unknown, data: Record<string, unknown>) => { updates.push(data); return transaction; },
  };
  const firestore = {
    runTransaction: async <T>(operation: (value: typeof transaction) => Promise<T>) => operation(transaction),
  };

  await withOperatorAttribution("trusted-operator-uid", () => attributedFirestore(firestore as never).runTransaction(async (tx) => {
    tx.create({} as never, { status: "active", createdBy: "caller-controlled", updatedBy: "caller-controlled" });
    tx.update({} as never, { status: "archived", updatedBy: "caller-controlled" });
  }));

  assert.deepEqual(creates, [{ status: "active", createdBy: "trusted-operator-uid", updatedBy: "trusted-operator-uid" }]);
  assert.deepEqual(updates, [{ status: "archived", updatedBy: "trusted-operator-uid" }]);
});
