import assert from "node:assert/strict";
import test from "node:test";
import { getFirestore } from "firebase-admin/firestore";
import { createBreedingCycle } from "../src/services/firestore.js";
import { createEgg } from "../src/services/phase5c.js";
import { getPairDetails } from "../src/services/reads.js";
import "../src/index.js";

const db=getFirestore(); const suffix=`breeding-${Date.now()}`;
const seedPair=async(status:"draft"|"active")=>{const pairId=`${suffix}-${status}`;await db.collection("pairs").doc(pairId).set({status,startedOn:"2026-08-01"});for(const [role,birdId] of [["male",`${pairId}-m`],["female",`${pairId}-f`]] as const){await db.collection("birds").doc(birdId).set({ringId:birdId,displayName:role,status:"active",origin:"external"});await db.collection("sexHistory").doc(`${birdId}-sex`).set({birdId,sex:role,determinedOn:"2026-08-01",method:"dna"});await db.collection("pairMembers").doc(`${pairId}-${role}`).set({pairId,birdId,role,effectiveFrom:"2026-08-01"});}return pairId;};

test("canonical Cycle and Egg invariants and nested readback",async()=>{
  const draft=await seedPair("draft"); await assert.rejects(createBreedingCycle(db,{pairId:draft,startedOn:"2026-08-14"}));
  const pairId=await seedPair("active"); const first=await createBreedingCycle(db,{pairId,startedOn:"2026-08-14"}); const second=await createBreedingCycle(db,{pairId,startedOn:"2026-08-15"}); assert.notEqual(first.breedingCycleId,second.breedingCycleId,"canonical contract permits multiple active cycles");
  await createEgg(db,{cycleId:first.breedingCycleId,sequenceNo:1,laidOn:"2026-08-16"}); await assert.rejects(createEgg(db,{cycleId:first.breedingCycleId,sequenceNo:1,laidOn:"2026-08-17"}));
  const detail=await getPairDetails(db,{pairId}); const cycle=detail.cycles.find(item=>item.breedingCycleId===first.breedingCycleId); assert.equal(cycle?.eggs[0].sequenceNo,1); assert.equal(cycle?.eggs[0].laidOn,"2026-08-16");
});
