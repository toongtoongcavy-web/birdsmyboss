import { randomBytes } from "node:crypto";
import { FieldValue, Firestore } from "firebase-admin/firestore";
import { fail } from "../domain/errors.js";
import { requireDate, requireId } from "../domain/validation.js";
import { createOpaquePhotoHandle, opaquePhotoUrl } from "./public-media.js";
const id=()=>crypto.randomUUID(), now=()=>FieldValue.serverTimestamp(), ref=(db:Firestore,c:string,id:string)=>db.collection(c).doc(id);
const nonNegative=(v:unknown,n:string):number=>{if(typeof v!=="number"||!Number.isFinite(v)||v<0)fail("invalid-argument",`${n} must be non-negative.`);return v as number;};
const recipientSnapshot=(value:unknown)=>{if(!value||typeof value!=="object"||Array.isArray(value))fail("invalid-argument","recipientSnapshot is required.");const data=value as Record<string,unknown>,allowed=["name","phone","address"];if(Object.keys(data).some(key=>!allowed.includes(key)))fail("invalid-argument","recipientSnapshot contains unsupported fields.");if(typeof data.name!=="string"||!data.name.trim())fail("invalid-argument","recipientSnapshot.name is required.");if(data.phone!==undefined&&typeof data.phone!=="string")fail("invalid-argument","recipientSnapshot.phone must be a string.");if(data.address!==undefined&&typeof data.address!=="string")fail("invalid-argument","recipientSnapshot.address must be a string.");const name=data.name as string;return{name:name.trim(),...(typeof data.phone==="string"&&data.phone.trim()?{phone:data.phone.trim()}:{}),...(typeof data.address==="string"&&data.address.trim()?{address:data.address.trim()}: {})};};
export const createDelivery=async(db:Firestore,input:Record<string,unknown>)=>{const saleId=requireId(input.saleId,"saleId"),createdOn=requireDate(input.createdOn,"createdOn");const distanceKm=nonNegative(input.distanceKm,"distanceKm"),freeDistanceKm=nonNegative(input.freeDistanceKm,"freeDistanceKm"),pricePerKm=nonNegative(input.pricePerKm,"pricePerKm"),shippingFee=Math.max(distanceKm-freeDistanceKm,0)*pricePerKm;return db.runTransaction(async tx=>{const sale=await tx.get(ref(db,"sales",saleId));if(!sale.exists)fail("not-found","Sale not found.");if(sale.data()?.status!=="completed")fail("failed-precondition","Delivery requires a completed sale.");const deliveryId=id();tx.create(ref(db,"deliveries",deliveryId),{saleId,distanceKm,freeDistanceKm,pricePerKm,shippingFee,currency:requireId(input.currency,"currency"),createdOn,status:"planned",createdAt:now(),updatedAt:now()});return{deliveryId};});};
export const completeHandover=async(db:Firestore,input:Record<string,unknown>)=>{const sourceType=input.sourceType;if(sourceType!=="sale"&&sourceType!=="giveaway")fail("invalid-argument","Handover sourceType must be sale or giveaway.");const birdId=requireId(input.birdId,"birdId"),handoverOn=requireDate(input.handoverOn,"handoverOn"),snapshot=recipientSnapshot(input.recipientSnapshot),sourceId=requireId(input[sourceType==="sale"?"saleId":"giveawayId"],sourceType==="sale"?"saleId":"giveawayId");return db.runTransaction(async tx=>{const sourceCollection=sourceType==="sale"?"sales":"giveaways",[bird,source,existingBirdHandover,existingSourceHandover]=await Promise.all([tx.get(ref(db,"birds",birdId)),tx.get(ref(db,sourceCollection,sourceId)),tx.get(db.collection("handovers").where("birdId","==",birdId).where("status","==","completed")),tx.get(db.collection("handovers").where(sourceType==="sale"?"saleId":"giveawayId","==",sourceId).where("status","==","completed"))]);if(!bird.exists||!source.exists||source.data()?.status!=="completed"||source.data()?.birdId!==birdId)fail("failed-precondition",sourceType==="sale"?"Completed sale and bird must match.":"Completed giveaway and bird must match.");if(["sold","given_away"].includes(String(bird.data()?.status)))fail("failed-precondition","Bird has already been transferred.");if(!existingBirdHandover.empty||!existingSourceHandover.empty)fail("failed-precondition","Source already has a completed handover.");const handoverId=id();tx.create(ref(db,"handovers",handoverId),{birdId,[sourceType==="sale"?"saleId":"giveawayId"]:sourceId,handoverOn,recipientSnapshot:snapshot,sourceType,status:"completed",createdAt:now(),updatedAt:now()});if(sourceType==="giveaway")tx.update(source.ref,{handoverId,updatedAt:now()});tx.update(ref(db,"birds",birdId),{status:sourceType==="sale"?"sold":"given_away",updatedAt:now()});return{handoverId};});};
export const rotatePassportToken=async(db:Firestore,input:Record<string,unknown>)=>{const birdId=requireId(input.birdId,"birdId");return db.runTransaction(async tx=>{const bird=await tx.get(ref(db,"birds",birdId));if(!bird.exists)fail("not-found","Bird not found.");const publicToken=randomBytes(16).toString("base64url");const used=await tx.get(db.collection("birds").where("publicToken","==",publicToken));if(!used.empty)fail("already-exists","Retry token rotation.");tx.update(ref(db,"birds",birdId),{publicToken,updatedAt:now()});return{publicToken};});};
export const resolvePassport=async(db:Firestore,token:unknown,mediaKey=process.env.BMB_PUBLIC_MEDIA_KEY)=>{
  if(typeof token!=="string"||!token)return null;
  const birds=await db.collection("birds").where("publicToken","==",token).where("passportStatus","==","published").get();
  if(birds.size!==1)return null;
  const b=birds.docs[0],data=b.data(),birdId=b.id;
  let parentage:null|{male:{ringId:unknown}|null;female:{ringId:unknown}|null}=null;
  if(typeof data.eggId==="string"){
    const egg=await ref(db,"eggs",data.eggId).get();
    const cycle=egg.exists&&typeof egg.data()?.cycleId==="string"?await ref(db,"breedingCycles",egg.data()!.cycleId).get():null;
    if(cycle?.exists){
      const members=await db.collection("pairMembers").where("pairId","==",cycle.data()?.pairId).get();
      const identity=async(role:string)=>{
        const parentId=members.docs.find(x=>x.data().role===role)?.data().birdId;
        if(typeof parentId!=="string")return null;
        const parent=await ref(db,"birds",parentId).get();
        return parent.exists?{ringId:parent.data()?.ringId??null}:null;
      };
      parentage={male:await identity("male"),female:await identity("female")};
    }
  }
  const [photos,documents,handovers,sexHistory]=await Promise.all([
    db.collection("photos").where("ownerType","==","BIRD").where("ownerId","==",birdId).where("status","==","active").where("isPublicOnPassport","==",true).get(),
    db.collection("documents").where("ownerType","==","BIRD").where("ownerId","==",birdId).where("status","==","active").where("isPublicOnPassport","==",true).get(),
    db.collection("handovers").where("birdId","==",birdId).where("status","==","completed").get(),
    db.collection("sexHistory").where("birdId","==",birdId).get()
  ]);
  const sex=sexHistory.docs.map(x=>x.data()).filter(x=>x.sex!=="unknown").sort((a,b)=>String(b.determinedOn??"").localeCompare(String(a.determinedOn??"")))[0]?.sex??"unknown";
  const publicPhotos=typeof mediaKey==="string"&&mediaKey?photos.docs.filter(x=>x.data().managedStorage===true).map(x=>({publicUrl:opaquePhotoUrl(createOpaquePhotoHandle(mediaKey,birdId,x.id,String(data.publicToken))),caption:x.data().caption??null,sortOrder:x.data().sortOrder??null})):[];
  return{ringId:data.ringId,mutation:data.mutation??null,hatchedOn:data.hatchedOn??null,sex,origin:data.origin,passportStatus:data.passportStatus,parentage,photos:publicPhotos,documents:documents.docs.map(x=>({documentType:x.data().documentType,issuedOn:x.data().issuedOn, ...(x.data().documentNumber?{documentNumber:x.data().documentNumber}:{})})),handoverOn:handovers.docs[0]?.data().handoverOn??null};
};
