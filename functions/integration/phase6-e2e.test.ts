import assert from "node:assert/strict";
import test from "node:test";
import { Firestore } from "firebase-admin/firestore";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const projectId = "birdsmyboss-v1-dev";
const functionsBase = `http://127.0.0.1:5001/${projectId}/us-central1`;
const authBase = "http://127.0.0.1:9099";
const firestoreBase = "http://127.0.0.1:8080";
const db = new Firestore({ projectId });
const adminAuth = getAuth(initializeApp({ projectId }));
const operator = { email: "phase6-operator@example.test", password: "phase6-emulator-only" };
let token = "";

type Json = Record<string, unknown>;
const callRaw = (name: string, data: Json, authenticated = true) => fetch(`${functionsBase}/${name}`, {
  method: "POST",
  headers: { "content-type": "application/json", ...(authenticated ? { authorization: `Bearer ${token}` } : {}) },
  body: JSON.stringify({ data }),
});
const call = async <T extends Json | Json[] | null>(name: string, data: Json = {}) => {
  const response = await callRaw(name, data);
  const body = await response.json() as { result?: T; error?: Json };
  assert.equal(response.ok, true, `${name} failed: ${JSON.stringify(body.error)}`);
  return body.result as T;
};
const rejectsCall = async (name: string, data: Json, status?: string) => {
  const response = await callRaw(name, data);
  const body = await response.json() as { error?: { status?: string } };
  assert.equal(response.ok, false, `${name} unexpectedly succeeded`);
  if (status) assert.equal(body.error?.status, status);
};
const hasId = (rows: Json[], field: string, value: string) => rows.some((row) => row[field] === value);
const assertDate = (value: unknown) => assert.match(String(value), /^\d{4}-\d{2}-\d{2}$/);

test.before(async () => {
  const clearFirestore = await fetch(`${firestoreBase}/emulator/v1/projects/${projectId}/databases/(default)/documents`, { method: "DELETE" });
  assert.equal(clearFirestore.ok, true);
  const clearAuth = await fetch(`${authBase}/emulator/v1/projects/${projectId}/accounts`, { method: "DELETE" });
  assert.equal(clearAuth.ok, true);
  const auth = await fetch(`${authBase}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=development-only`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...operator, returnSecureToken: true }),
  });
  assert.equal(auth.ok, true);
  const authBody = await auth.json() as { localId?: string; refreshToken?: string };
  assert.ok(authBody.localId); assert.ok(authBody.refreshToken);
  await adminAuth.setCustomUserClaims(authBody.localId, { operator: true });
  const refreshed = await fetch(`${authBase}/securetoken.googleapis.com/v1/token?key=development-only`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: authBody.refreshToken }) });
  assert.equal(refreshed.ok, true);
  token = String((await refreshed.json() as { id_token?: string }).id_token ?? "");
  assert.ok(token);
});

test("Phase 6 complete authenticated V1 lifecycle", async () => {
  const stamp = { createdAt: new Date(), updatedAt: new Date() };
  const maleBirdId = "phase6-parent-male", femaleBirdId = "phase6-parent-female";
  await db.collection("birds").doc(maleBirdId).create({ ringId: "E2E-PARENT-M", origin: "external", displayName: "E2E Father", status: "active", passportStatus: "draft", ...stamp });
  await db.collection("birds").doc(femaleBirdId).create({ ringId: "E2E-PARENT-F", origin: "external", displayName: "E2E Mother", status: "active", passportStatus: "draft", ...stamp });
  await call("recordSexHistory", { birdId: maleBirdId, sex: "male", determinedOn: "2026-01-01", method: "dna" });
  await call("recordSexHistory", { birdId: femaleBirdId, sex: "female", determinedOn: "2026-01-01", method: "dna" });
  assert.equal((await db.collection("sexHistory").where("birdId", "==", maleBirdId).get()).docs[0].data().sex, "male");

  const { cageId } = await call<Json>("createCage", { code: "e2e-cage-01", name: "E2E Cage", status: "active" });
  await rejectsCall("createCage", { code: "E2E-CAGE-01", name: "Duplicate", status: "active" }, "ALREADY_EXISTS");
  const { pairId } = await call<Json>("createPair", { maleBirdId, femaleBirdId, startedOn: "2026-01-01" });
  assert.equal((await db.collection("pairMembers").where("pairId", "==", pairId).get()).size, 2);
  await call("activatePair", { pairId, activeOn: "2026-01-02" });
  const { cageAssignmentId } = await call<Json>("assignPairToCage", { pairId, cageId, startsOn: "2026-01-02" });
  assert.ok(cageAssignmentId);
  await rejectsCall("assignPairToCage", { pairId, cageId, startsOn: "2026-01-03" }, "FAILED_PRECONDITION");
  const { breedingCycleId } = await call<Json>("createBreedingCycle", { pairId, startedOn: "2026-01-03", code: "E2E-CYCLE-01" });
  const { eggId } = await call<Json>("createEgg", { cycleId: breedingCycleId, sequenceNo: 1, laidOn: "2026-01-04" });
  await rejectsCall("createEgg", { cycleId: breedingCycleId, sequenceNo: 1, laidOn: "2026-01-04" }, "ALREADY_EXISTS");
  const created = await call<Json>("createBirdFromEgg", { eggId, ringId: " e2e-ring-001 ", origin: "farm_hatched", displayName: "E2E Chick", mutation: "E2E Mutation", hatchedOn: "2026-01-20" });
  const birdId = String(created.birdId); assert.equal(created.ringId, "E2E-RING-001");
  const birdDoc = (await db.collection("birds").doc(birdId).get()).data()!;
  assert.equal(birdDoc.eggId, eggId); assert.equal("fatherId" in birdDoc, false); assert.equal("motherId" in birdDoc, false);
  await rejectsCall("createBirdFromEgg", { eggId, ringId: "E2E-RING-002", origin: "farm_hatched", displayName: "Second" }, "ALREADY_EXISTS");
  const secondEgg = await call<Json>("createEgg", { cycleId: breedingCycleId, sequenceNo: 2, laidOn: "2026-01-05" });
  await rejectsCall("createBirdFromEgg", { eggId: secondEgg.eggId, ringId: "e2e-ring-001", origin: "farm_hatched", displayName: "Duplicate ring" }, "ALREADY_EXISTS");

  await call("recordWeightHistory", { birdId, weightGrams: 125, measuredOn: "2026-01-21" });
  await call("recordWeightHistory", { birdId, weightGrams: 140, measuredOn: "2026-01-22" });
  await call("recordSexHistory", { birdId, sex: "female", determinedOn: "2026-02-01", method: "dna" });
  const detail = await call<Json>("getBirdDetails", { birdId });
  assert.equal(detail.passportStatus, "draft");
  assert.equal((detail.parentage as Json).male && ((detail.parentage as Json).male as Json).birdId, maleBirdId);
  assert.equal(((detail.parentage as Json).female as Json).birdId, femaleBirdId);
  assert.deepEqual((detail.weightHistory as Json[]).map(x => x.weightGrams).sort(), [125, 140]);
  assert.equal((detail.sexHistory as Json[])[0].sex, "female");
  assert.equal(hasId(await call<Json[]>("listBirds", { limit: 50 }), "birdId", birdId), true);

  const { customerId } = await call<Json>("createCustomer", { displayName: "E2E Customer", phone: "0899999999", email: "customer@example.test", address: "Private customer address" });
  const { reservationId } = await call<Json>("createReservation", { birdId, customerId, reservedOn: "2026-02-02", expiresOn: "2026-02-10" });
  await rejectsCall("createReservation", { birdId, customerId, reservedOn: "2026-02-03" }, "FAILED_PRECONDITION");
  assert.notEqual((await db.collection("birds").doc(birdId).get()).data()?.status, "sold");
  const { paymentId } = await call<Json>("recordPayment", { reservationId, amount: 1000, currency: "THB", receivedOn: "2026-02-02", paymentMethod: "transfer" });
  const paymentBefore = (await db.collection("payments").doc(String(paymentId)).get()).data()!;
  assert.equal(paymentBefore.reservationId, reservationId); assert.equal("saleId" in paymentBefore, false);
  const refund = await call<Json>("refundPayment", { paymentId, outcome: "partial_refund", amount: 250, reason: "E2E partial", refundedOn: "2026-02-03" });
  assert.equal(refund.amount, 250);
  await rejectsCall("refundPayment", { paymentId, outcome: "partial_refund", amount: 751, reason: "too much", refundedOn: "2026-02-04" }, "FAILED_PRECONDITION");
  assert.deepEqual((await db.collection("payments").doc(String(paymentId)).get()).data()?.amount, paymentBefore.amount);

  const { saleId } = await call<Json>("createSale", { birdId, customerId, reservationId, createdOn: "2026-02-05" });
  await rejectsCall("completeSale", { saleId, completedOn: "2026-02-06" }, "FAILED_PRECONDITION");
  await call("confirmSale", { saleId });
  await call("completeSale", { saleId, completedOn: "2026-02-06" });
  assert.equal((await db.collection("reservations").doc(String(reservationId)).get()).data()?.status, "completed");
  assert.notEqual((await db.collection("birds").doc(birdId).get()).data()?.status, "sold");
  await rejectsCall("createSale", { birdId, customerId, createdOn: "2026-02-07" }, "FAILED_PRECONDITION");
  const timeline = await db.collection("saleTimeline").where("saleId", "==", saleId).get();
  assert.deepEqual(timeline.docs.map(x => x.data().eventType).sort(), ["sale_completed", "sale_created"]);
  assert.equal((await db.collection("saleTimeline").get()).docs.some(x => !x.data().saleId), false);

  const { deliveryId } = await call<Json>("createDelivery", { saleId, distanceKm: 20, freeDistanceKm: 5, pricePerKm: 10, currency: "THB", createdOn: "2026-02-07" });
  const delivery = (await db.collection("deliveries").doc(String(deliveryId)).get()).data()!;
  assert.deepEqual([delivery.distanceKm, delivery.freeDistanceKm, delivery.pricePerKm, delivery.shippingFee], [20, 5, 10, 150]);
  const snapshot = { name: "E2E Recipient", phone: "0812345678", address: "E2E Test Address" };
  await rejectsCall("completeHandover", { birdId, saleId, sourceType: "sale", handoverOn: "2026-02-08", recipientSnapshot: { ...snapshot, customerId } }, "INVALID_ARGUMENT");
  const { handoverId } = await call<Json>("completeHandover", { birdId, saleId, sourceType: "sale", handoverOn: "2026-02-08", recipientSnapshot: snapshot });
  assert.equal((await db.collection("birds").doc(birdId).get()).data()?.status, "sold");
  await rejectsCall("completeHandover", { birdId, saleId, sourceType: "sale", handoverOn: "2026-02-09", recipientSnapshot: snapshot }, "FAILED_PRECONDITION");
  await db.collection("customers").doc(String(customerId)).update({ phone: "0000000000", address: "Changed" });
  assert.deepEqual((await db.collection("handovers").doc(String(handoverId)).get()).data()?.recipientSnapshot, snapshot);

  await rejectsCall("addBirdPhoto", { ownerType: "BIRD", ownerId: birdId, storagePath: "private/e2e.jpg", publicUrl: "https://example.test/private.jpg", caption: "private", status: "active" }, "FAILED_PRECONDITION");
  assert.equal(await call<null>("getBirdPassport", { publicToken: "invalid" }), null);
  await call("setPassportStatus", { birdId, passportStatus: "published" });
  const oldToken = String((await db.collection("birds").doc(birdId).get()).data()?.publicToken); assert.ok(oldToken);
  const passport = await call<Json>("getBirdPassport", { publicToken: oldToken });
  assert.equal((passport.photos as Json[]).length, 0);
  assert.equal((passport.documents as Json[]).length, 0);
  const forbidden = ["publicToken", "birdId", "phone", "address", "customerId", "payment", "refund", "price", "notes", "storagePath", "checksum", "fatherId", "motherId"];
  for (const key of forbidden) assert.equal(key in passport || JSON.stringify(passport).includes(`\"${key}\"`), false, `public passport leaked ${key}`);
  assert.deepEqual(passport.parentage, { male: { ringId: "E2E-PARENT-M" }, female: { ringId: "E2E-PARENT-F" } });
  const rotated = await call<Json>("rotatePassportToken", { birdId }); assert.notEqual(rotated.publicToken, oldToken);
  assert.equal(await call<null>("getBirdPassport", { publicToken: oldToken }), null);
  assert.ok(await call<Json>("getBirdPassport", { publicToken: String(rotated.publicToken) }));
  await call("setPassportStatus", { birdId, passportStatus: "disabled" });
  assert.equal(await call<null>("getBirdPassport", { publicToken: String(rotated.publicToken) }), null);
  await call("setPassportStatus", { birdId, passportStatus: "draft" });
  assert.equal(await call<null>("getBirdPassport", { publicToken: String(rotated.publicToken) }), null);
  await call("setPassportStatus", { birdId, passportStatus: "published" });
  assert.ok(await call<Json>("getBirdPassport", { publicToken: String(rotated.publicToken) }));

  const reads: Array<[string, Json, string, string]> = [
    ["listCages", {}, "cageId", String(cageId)], ["listPairs", {}, "pairId", String(pairId)],
    ["listBreedingCycles", {}, "breedingCycleId", String(breedingCycleId)], ["listEggs", {}, "eggId", String(eggId)],
    ["listCustomers", {}, "customerId", String(customerId)], ["listReservations", {}, "reservationId", String(reservationId)],
    ["listSales", {}, "saleId", String(saleId)], ["listPayments", {}, "paymentId", String(paymentId)],
    ["listRefunds", {}, "refundId", String(refund.refundId)], ["listDeliveries", {}, "deliveryId", String(deliveryId)],
    ["listHandovers", {}, "handoverId", String(handoverId)], ["listEligibleCompletedSales", {}, "saleId", String(saleId)],
  ];
  for (const [name, input, field, value] of reads) assert.equal(hasId(await call<Json[]>(name, { ...input, limit: 50 }), field, value), true, `${name} omitted fixture`);
  const pairDetail = await call<Json>("getPairDetails", { pairId }); assert.equal((pairDetail.members as Json[]).length, 2);
  const customerDetail = await call<Json>("getCustomerDetails", { customerId }); assert.equal((customerDetail.sales as Json[]).some(x => x.saleId === saleId), true);
  const summary = await call<Json>("getDashboardSummary"); assert.equal(summary.birds, 3); assert.equal(summary.activePairs, 1);
  for (const value of ["2026-01-01", birdDoc.hatchedOn, paymentBefore.receivedOn, delivery.createdOn, (await db.collection("handovers").doc(String(handoverId)).get()).data()?.handoverOn]) assertDate(value);

  const unauthenticated = await callRaw("getDashboardSummary", {}, false); assert.equal(unauthenticated.ok, false);
  const direct = await fetch(`${firestoreBase}/v1/projects/${projectId}/databases/(default)/documents/birds/${birdId}`, { headers: { authorization: `Bearer ${token}` } });
  assert.equal(direct.status, 403);
});
