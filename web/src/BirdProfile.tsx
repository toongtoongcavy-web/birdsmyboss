import type { ReactNode } from "react";
import { isoToThaiDisplay } from "./date";
import { displayValue } from "./presentation";
import { EmptyState, StatusBadge } from "./ui";
import { OrangeRing } from "./bmb-design-system";

type Row=Record<string,any>;
const value=(input:unknown)=>displayValue(input);

function BirdPortrait({name,photos}:{name:unknown;photos:Row[]}) {
  const photo=photos.find(item=>item.isPublicOnPassport===true&&typeof item.publicUrl==="string"&&item.publicUrl);
  return <figure className={`bird-portrait ${photo?"has-photo":"placeholder"}`}>{photo?<img src={photo.publicUrl} alt={`ภาพของ ${value(name)}`}/>:<div aria-label="ยังไม่มีภาพนกที่เผยแพร่"><span className="portrait-ring"/><b>{String(value(name)).slice(0,1)}</b><small>ภาพประจำตัว</small></div>}{photo?.caption&&<figcaption>{value(photo.caption)}</figcaption>}</figure>;
}

function IdentityMeta({label,children}:{label:string;children:ReactNode}) { return <div className="identity-meta"><small>{label}</small><strong>{children}</strong></div>; }
function ParentNode({role,parent}:{role:string;parent?:Row}) { return <article className="parent-node"><small>{role}</small><strong>{value(parent?.displayName)}</strong><span>Ring ID {value(parent?.ringId)}</span></article>; }

export function BirdProfile({data,currentSex,sexHistory,weightHistory,forms,passport,priceHistory}:{data:Row;currentSex:unknown;sexHistory:Row[];weightHistory:Row[];forms:ReactNode;passport:ReactNode;priceHistory?:ReactNode}) {
  const parentage=data.parentage as Row|null;const father=parentage?.male as Row|undefined,mother=parentage?.female as Row|undefined;const photos=Array.isArray(data.photos)?data.photos as Row[]:[];
  return <div className="bird-profile">
    <section className="bird-identity-hero" aria-label="ข้อมูลประจำตัวนก">
      <BirdPortrait name={data.displayName} photos={photos}/>
      <div className="bird-identity-copy"><span className="profile-kicker">Birds My Boss · Bird Profile</span><div className="bird-name-line"><h2>{value(data.displayName)}</h2><StatusBadge status={data.status}/></div><div className="ring-identity"><OrangeRing variant="standard"/><small>RING ID</small><strong>{value(data.ringId)}</strong></div><div className="identity-meta-grid"><IdentityMeta label="Mutation">{value(data.mutation)}</IdentityMeta><IdentityMeta label="เพศ">{value(currentSex)}</IdentityMeta><IdentityMeta label="วันฟัก / วันเกิด">{isoToThaiDisplay(data.hatchedOn)||"-"}</IdentityMeta><IdentityMeta label="แหล่งที่มา">{value(data.origin)}</IdentityMeta></div></div>
      <aside className="passport-seal"><span>PASS</span><small>Passport</small><StatusBadge status={data.passportStatus??"draft"}/></aside>
    </section>

    <section className="story-section lineage-section"><header><span>01</span><div><small>สายเลือดและตัวตน</small><h3>ครอบครัวของ {value(data.displayName)}</h3></div></header><div className="lineage-map"><ParentNode role="พ่อนก" parent={father}/><article className="lineage-bird"><OrangeRing variant="compact" className="mini-ring"/><strong>{value(data.displayName)}</strong><small>{value(data.ringId)}</small></article><ParentNode role="แม่นก" parent={mother}/></div><p className="sr-only">พ่อแม่: {value(father?.ringId)} / {value(mother?.ringId)}</p></section>

    <section className="story-section"><header><span>02</span><div><small>บันทึกที่เชื่อถือได้</small><h3>เรื่องราวในฟาร์ม</h3></div></header><div className="life-timeline">{data.hatchedOn&&<article><i/><small>วันฟัก / วันเกิด</small><strong>{isoToThaiDisplay(data.hatchedOn)}</strong></article>}{sexHistory.map((entry,index)=><article key={`sex-${index}`}><i/><small>ยืนยันเพศ · {value(entry.method)}</small><strong>{value(entry.sex)} · {isoToThaiDisplay(entry.determinedOn)||value(entry.determinedOn)}</strong></article>)}{weightHistory.map((entry,index)=><article key={`weight-${index}`}><i/><small>บันทึกน้ำหนัก</small><strong>{value(entry.weightGrams)} กรัม · {isoToThaiDisplay(entry.measuredOn)||"-"}</strong></article>)}</div></section>

    <div className="profile-history-grid"><section className="history-ledger"><header><h3>ประวัติเพศ: {sexHistory.length}</h3><p>หลักฐานการระบุเพศตามลำดับเวลา</p></header>{sexHistory.length?sexHistory.map((entry,index)=><article key={index}><span>{String(index+1).padStart(2,"0")}</span><div><strong>{value(entry.sex)}</strong><small>{value(entry.method)} · {isoToThaiDisplay(entry.determinedOn)||value(entry.determinedOn)}</small></div></article>):<EmptyState title="ยังไม่มีประวัติเพศ"/>}</section><section className="history-ledger"><header><h3>ประวัติน้ำหนัก: {weightHistory.length}</h3><p>ค่าชั่งจริงที่บันทึกไว้ในระบบ</p></header>{weightHistory.length?weightHistory.map((entry,index)=><article key={index}><span>{String(index+1).padStart(2,"0")}</span><div><strong>{value(entry.weightGrams)} กรัม</strong><small>{isoToThaiDisplay(entry.measuredOn)||"-"}</small></div></article>):<EmptyState title="ยังไม่มีประวัติน้ำหนัก"/>}</section></div>

    {priceHistory}

    <section className="profile-passport"><div className="passport-intro"><span className="passport-mark">B</span><div><small>IDENTITY & PROVENANCE</small><h3>Bird Passport</h3><p>สถานะเอกสารประจำตัว: <StatusBadge status={data.passportStatus??"draft"}/></p></div></div><div className="passport-controls">{passport}</div></section>
    <section className="profile-record-actions"><header><small>สำหรับผู้ปฏิบัติงาน</small><h3>เพิ่มบันทึกใหม่</h3><p>ข้อมูลจะอัปเดตจาก trusted read หลังบันทึกสำเร็จ</p></header>{forms}</section>
  </div>;
}
