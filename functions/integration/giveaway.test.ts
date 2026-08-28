import assert from "node:assert/strict";
import test from "node:test";
import { Firestore } from "firebase-admin/firestore";
import { cancelGiveaway, completeGiveaway, createGiveaway } from "../src/services/giveaway.js";
import { completeSale, createCustomer, createSale, confirmSale } from "../src/services/commercial.js";
import { completeHandover } from "../src/services/phase4.js";
import { getGiveawayDetails, listGiveaways } from "../src/services/reads.js";

const db = new Firestore({ projectId: "birdsmyboss-v1-dev" });
let sequence = 0;
const key = (prefix: string) => `${prefix}-${Date.now()}-${sequence++}`;
const stamp = { createdAt: new Date(), updatedAt: new Date() };

const seedBird = async (status = "active") => {
  const birdId = key("giveaway-bird");
  await db.collection("birds").doc(birdId).set({ ringId: key("ring"), displayName: "Giveaway Bird", origin: "external", status, passportStatus: "draft", ...stamp });
  return birdId;
};
const seedCustomer = async () => {
  const result = await createCustomer(db, { displayName: "Giveaway Customer" }) as { customerId: string };
  return result.customerId;
};

test("Giveaway completion preserves Bird.status until Handover while blocking conflicting transfer workflows", async () => {
  const birdId = await seedBird();
  const customerId = await seedCustomer();
  const created = await createGiveaway(db, { birdId, customerId, recipientName: "Agreement recipient", givenOn: "2026-08-23" }) as { giveawayId: string };
  assert.equal((await db.collection("giveaways").doc(created.giveawayId).get()).data()?.status, "planned");
  await completeGiveaway(db, { giveawayId: created.giveawayId });
  assert.equal((await db.collection("giveaways").doc(created.giveawayId).get()).data()?.status, "completed");
  assert.equal((await db.collection("birds").doc(birdId).get()).data()?.status, "active");
  await assert.rejects(cancelGiveaway(db, { giveawayId: created.giveawayId }));
  await assert.rejects(completeGiveaway(db, { giveawayId: created.giveawayId }));
});

test("Giveaway cancellation is terminal and Customer remains optional", async () => {
  const created = await createGiveaway(db, { birdId: await seedBird(), recipientName: "Agreement only", givenOn: "2026-08-23" }) as { giveawayId: string };
  await cancelGiveaway(db, { giveawayId: created.giveawayId });
  assert.equal((await db.collection("giveaways").doc(created.giveawayId).get()).data()?.customerId, undefined);
  await assert.rejects(completeGiveaway(db, { giveawayId: created.giveawayId }));
});

test("Giveaway trusted list and detail reads provide canonical transfer context", async () => {
  const birdId = await seedBird();
  const customerId = await seedCustomer();
  const created = await createGiveaway(db, { birdId, customerId, recipientName: "Agreement recipient", givenOn: "2026-08-23" }) as { giveawayId: string };
  const list = await listGiveaways(db, { limit: 50 }) as Array<Record<string, any>>;
  const listed = list.find((giveaway) => giveaway.giveawayId === created.giveawayId);
  assert.ok(listed);
  assert.equal(listed.bird.ringId.startsWith("ring-"), true);
  assert.equal(listed.customer?.customerId, customerId);
  assert.equal(listed.status, "planned");
  const detail = await getGiveawayDetails(db, { giveawayId: created.giveawayId }) as Record<string, any>;
  assert.ok(detail.bird);
  assert.equal(detail.bird.birdId, birdId);
  assert.equal(detail.customer?.customerId, customerId);
  assert.equal(detail.recipientName, "Agreement recipient");
  assert.equal(detail.handover, null);
});

test("Sale and Giveaway commitments are mutually exclusive", async () => {
  const birdId = await seedBird();
  const customerId = await seedCustomer();
  await createGiveaway(db, { birdId, recipientName: "Recipient", givenOn: "2026-08-23" });
  await assert.rejects(createSale(db, { birdId, customerId, createdOn: "2026-08-23" }));
  const saleBird = await seedBird();
  const sale = await createSale(db, { birdId: saleBird, customerId, createdOn: "2026-08-23" }) as { saleId: string };
  await assert.rejects(createGiveaway(db, { birdId: saleBird, recipientName: "Recipient", givenOn: "2026-08-23" }));
  await confirmSale(db, { saleId: sale.saleId });
  await completeSale(db, { saleId: sale.saleId, completedOn: "2026-08-23" });
  await assert.rejects(createGiveaway(db, { birdId: saleBird, recipientName: "Recipient", givenOn: "2026-08-23" }));
  await assert.rejects(createGiveaway(db, { birdId: await seedBird("sold"), recipientName: "Recipient", givenOn: "2026-08-23" }));
  await assert.rejects(createSale(db, { birdId: await seedBird("given_away"), customerId, createdOn: "2026-08-23" }));
});

test("Giveaway Handover requires its completed matching source and changes Bird only once", async () => {
  const birdId = await seedBird();
  const created = await createGiveaway(db, { birdId, recipientName: "Agreement recipient", givenOn: "2026-08-23" }) as { giveawayId: string };
  await assert.rejects(completeHandover(db, { sourceType: "giveaway", giveawayId: created.giveawayId, birdId, handoverOn: "2026-08-23", recipientSnapshot: { name: "Actual recipient" } }));
  await completeGiveaway(db, { giveawayId: created.giveawayId });
  await assert.rejects(completeHandover(db, { sourceType: "giveaway", giveawayId: created.giveawayId, birdId: await seedBird(), handoverOn: "2026-08-23", recipientSnapshot: { name: "Actual recipient" } }));
  const results = await Promise.allSettled([1, 2].map(() => completeHandover(db, { sourceType: "giveaway", giveawayId: created.giveawayId, birdId, handoverOn: "2026-08-23", recipientSnapshot: { name: "Actual recipient", phone: "0800000000" } })));
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
  assert.equal((await db.collection("birds").doc(birdId).get()).data()?.status, "given_away");
  const giveaway = (await db.collection("giveaways").doc(created.giveawayId).get()).data()!;
  const handover = await db.collection("handovers").doc(String(giveaway.handoverId)).get();
  assert.deepEqual(handover.data()?.recipientSnapshot, { name: "Actual recipient", phone: "0800000000" });
  await assert.rejects(createSale(db, { birdId, customerId: await seedCustomer(), createdOn: "2026-08-23" }));
});

test("conflicting Sale-vs-Giveaway completion race never creates two terminal commitments", async () => {
  const birdId = await seedBird();
  const customerId = await seedCustomer();
  const giveawayId = key("raced-giveaway"), saleId = key("raced-sale");
  await db.collection("giveaways").doc(giveawayId).set({ birdId, recipientName: "Recipient", givenOn: "2026-08-23", status: "planned", ...stamp });
  await db.collection("sales").doc(saleId).set({ birdId, customerId, createdOn: "2026-08-23", status: "confirmed", ...stamp });
  const results = await Promise.allSettled([completeGiveaway(db, { giveawayId }), completeSale(db, { saleId, completedOn: "2026-08-23" })]);
  assert.ok(results.filter(result => result.status === "fulfilled").length <= 1);
  const [giveaway, sale] = await Promise.all([db.collection("giveaways").doc(giveawayId).get(), db.collection("sales").doc(saleId).get()]);
  assert.equal(giveaway.data()?.status === "completed" && sale.data()?.status === "completed", false);
});
