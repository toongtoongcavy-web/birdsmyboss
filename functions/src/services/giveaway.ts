import { FieldValue, Firestore } from "firebase-admin/firestore";
import { fail } from "../domain/errors.js";
import { requireDate, requireId } from "../domain/validation.js";

const id = () => crypto.randomUUID();
const now = () => FieldValue.serverTimestamp();
const ref = (db: Firestore, collection: string, value: string) => db.collection(collection).doc(value);
const conflictingSaleStatuses = ["draft", "confirmed", "completed"];
const conflictingGiveawayStatuses = ["planned", "completed"];

const recipientName = (value: unknown) => {
  if (typeof value !== "string" || !value.trim()) fail("invalid-argument", "recipientName is required.");
  return String(value).trim();
};

const assertAvailableBird = (data: Record<string, unknown> | undefined) => {
  if (["sold", "given_away"].includes(String(data?.status))) fail("failed-precondition", "Bird is no longer available for a transfer.");
};

const assertNoConflictingSale = async (db: Firestore, tx: FirebaseFirestore.Transaction, birdId: string) => {
  const sales = await tx.get(db.collection("sales").where("birdId", "==", birdId).where("status", "in", conflictingSaleStatuses));
  if (!sales.empty) fail("failed-precondition", "Bird already has a conflicting sale.");
};

const assertNoConflictingGiveaway = async (db: Firestore, tx: FirebaseFirestore.Transaction, birdId: string, exceptGiveawayId?: string) => {
  const giveaways = await tx.get(db.collection("giveaways").where("birdId", "==", birdId).where("status", "in", conflictingGiveawayStatuses));
  if (giveaways.docs.some((giveaway) => giveaway.id !== exceptGiveawayId)) fail("failed-precondition", "Bird already has a conflicting giveaway.");
};

export const createGiveaway = async (db: Firestore, input: Record<string, unknown>) => {
  const birdId = requireId(input.birdId, "birdId");
  const givenOn = requireDate(input.givenOn, "givenOn");
  const customerId = input.customerId === undefined || input.customerId === null ? undefined : requireId(input.customerId, "customerId");
  const name = recipientName(input.recipientName);
  return db.runTransaction(async (tx) => {
    const [bird, customer] = await Promise.all([tx.get(ref(db, "birds", birdId)), customerId ? tx.get(ref(db, "customers", customerId)) : Promise.resolve(undefined)]);
    if (!bird.exists) fail("not-found", "Bird not found.");
    if (customerId && (!customer?.exists || customer.data()?.status !== "active")) fail("failed-precondition", "Customer must be active for a Giveaway reference.");
    assertAvailableBird(bird.data());
    await Promise.all([assertNoConflictingSale(db, tx, birdId), assertNoConflictingGiveaway(db, tx, birdId)]);
    const giveawayId = id();
    tx.create(ref(db, "giveaways", giveawayId), {
      birdId, recipientName: name, givenOn, ...(customerId ? { customerId } : {}),
      ...(typeof input.notes === "string" && input.notes.trim() ? { notes: input.notes.trim() } : {}),
      status: "planned", createdAt: now(), updatedAt: now(),
    });
    return { giveawayId };
  });
};

export const completeGiveaway = async (db: Firestore, input: Record<string, unknown>) => {
  const giveawayId = requireId(input.giveawayId, "giveawayId");
  return db.runTransaction(async (tx) => {
    const giveaway = await tx.get(ref(db, "giveaways", giveawayId));
    if (!giveaway.exists) fail("not-found", "Giveaway not found.");
    const data = giveaway.data()!;
    if (data.status !== "planned") fail("failed-precondition", "Only a planned Giveaway can be completed.");
    const birdId = requireId(data.birdId, "giveaway.birdId");
    const bird = await tx.get(ref(db, "birds", birdId));
    if (!bird.exists) fail("not-found", "Bird not found.");
    assertAvailableBird(bird.data());
    await Promise.all([assertNoConflictingSale(db, tx, birdId), assertNoConflictingGiveaway(db, tx, birdId, giveawayId)]);
    tx.update(giveaway.ref, { status: "completed", updatedAt: now() });
    return { giveawayId, status: "completed" };
  });
};

export const cancelGiveaway = async (db: Firestore, input: Record<string, unknown>) => {
  const giveawayId = requireId(input.giveawayId, "giveawayId");
  return db.runTransaction(async (tx) => {
    const giveaway = await tx.get(ref(db, "giveaways", giveawayId));
    if (!giveaway.exists) fail("not-found", "Giveaway not found.");
    if (giveaway.data()?.status !== "planned") fail("failed-precondition", "Only a planned Giveaway can be cancelled.");
    tx.update(giveaway.ref, { status: "cancelled", updatedAt: now() });
    return { giveawayId, status: "cancelled" };
  });
};
