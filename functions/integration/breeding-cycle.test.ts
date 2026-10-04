import assert from "node:assert/strict";
import test from "node:test";
import { getFirestore } from "firebase-admin/firestore";
import { cancelBreedingCycle, closeBreedingCycle, createBreedingCycle, transitionEggStatus } from "../src/services/firestore.js";
import { createEgg } from "../src/services/phase5c.js";
import { getPairDetails } from "../src/services/reads.js";
import "../src/index.js";

const db=getFirestore(); const suffix=`breeding-${Date.now()}`; let pairSequence=0;
const seedPair=async(status:"draft"|"active")=>{const pairId=`${suffix}-${status}-${pairSequence++}`;await db.collection("pairs").doc(pairId).set({status,startedOn:"2026-08-01"});for(const [role,birdId] of [["male",`${pairId}-m`],["female",`${pairId}-f`]] as const){await db.collection("birds").doc(birdId).set({ringId:birdId,displayName:role,status:"active",origin:"external"});await db.collection("sexHistory").doc(`${birdId}-sex`).set({birdId,sex:role,determinedOn:"2026-08-01",method:"dna"});await db.collection("pairMembers").doc(`${pairId}-${role}`).set({pairId,birdId,role,effectiveFrom:"2026-08-01"});}return pairId;};

test("canonical Cycle and Egg invariants and nested readback",async()=>{
  const draft=await seedPair("draft"); await assert.rejects(createBreedingCycle(db,{pairId:draft,startedOn:"2026-08-14"}));
  const pairId=await seedPair("active"); const first=await createBreedingCycle(db,{pairId,startedOn:"2026-08-14"}); const second=await createBreedingCycle(db,{pairId,startedOn:"2026-08-15"}); assert.notEqual(first.breedingCycleId,second.breedingCycleId,"canonical contract permits multiple active cycles");
  await createEgg(db,{cycleId:first.breedingCycleId,sequenceNo:1,laidOn:"2026-08-16"}); await assert.rejects(createEgg(db,{cycleId:first.breedingCycleId,sequenceNo:1,laidOn:"2026-08-17"}));
  const detail=await getPairDetails(db,{pairId}); const cycle=detail.cycles.find(item=>item.breedingCycleId===first.breedingCycleId); assert.equal(cycle?.eggs[0].sequenceNo,1); assert.equal(cycle?.eggs[0].laidOn,"2026-08-16");
});

test("BREED-08 rejects Egg creation for closed and cancelled cycles while active cycle remains valid",async()=>{
  const pairId=await seedPair("active");

  const closed=await createBreedingCycle(db,{pairId,startedOn:"2026-09-01"});
  const existing=await createEgg(db,{cycleId:closed.breedingCycleId,sequenceNo:1,laidOn:"2026-09-02"});
  await transitionEggStatus(db,{eggId:existing.eggId,targetStatus:"infertile"});
  await closeBreedingCycle(db,{breedingCycleId:closed.breedingCycleId,endedOn:"2026-09-03"});
  const closedHistoryBefore=await db.collection("eggs").where("cycleId","==",closed.breedingCycleId).get();
  await assert.rejects(createEgg(db,{cycleId:closed.breedingCycleId,sequenceNo:2,laidOn:"2026-09-04"}),/only in an active breeding cycle/);
  const closedHistoryAfter=await db.collection("eggs").where("cycleId","==",closed.breedingCycleId).get();
  assert.equal(closedHistoryAfter.size,closedHistoryBefore.size);
  assert.equal(closedHistoryAfter.docs[0].id,existing.eggId);
  assert.equal(closedHistoryAfter.docs[0].data().status,"infertile");
  assert.equal((await db.collection("breedingCycles").doc(closed.breedingCycleId).get()).data()?.status,"closed");

  const cancelled=await createBreedingCycle(db,{pairId,startedOn:"2026-09-05"});
  await cancelBreedingCycle(db,{breedingCycleId:cancelled.breedingCycleId,endedOn:"2026-09-06"});
  await assert.rejects(createEgg(db,{cycleId:cancelled.breedingCycleId,sequenceNo:1,laidOn:"2026-09-07"}),/only in an active breeding cycle/);
  assert.equal((await db.collection("eggs").where("cycleId","==",cancelled.breedingCycleId).get()).size,0);
  assert.equal((await db.collection("breedingCycles").doc(cancelled.breedingCycleId).get()).data()?.status,"cancelled");

  const active=await createBreedingCycle(db,{pairId,startedOn:"2026-09-08"});
  const accepted=await createEgg(db,{cycleId:active.breedingCycleId,sequenceNo:1,laidOn:"2026-09-09"});
  assert.equal((await db.collection("eggs").doc(accepted.eggId).get()).data()?.cycleId,active.breedingCycleId);
});
