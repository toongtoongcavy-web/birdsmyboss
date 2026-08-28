import { useEffect, useState } from "react";
import { OrangeRing } from "../bmb-design-system";
import { isoToThaiDisplay } from "../date";
import { invoke, thaiError } from "../functions";
import { displayValue } from "../presentation";
import "../Passport.css";

type Passport = {
  ringId?: string; mutation?: string | null; hatchedOn?: string | null; sex?: string; origin?: string;
  handoverOn?: string | null; passportStatus?: string;
  parentage?: { male?: { ringId?: string } | null; female?: { ringId?: string } | null } | null;
  photos?: Array<{ publicUrl?: string | null; caption?: string | null; sortOrder?: number | null }>;
  documents?: Array<{ documentType?: string; issuedOn?: string; documentNumber?: string }>;
};

const date = (value: unknown) => isoToThaiDisplay(typeof value === "string" ? value : null) || "-";

function LineageTrace({ parentage }: { parentage: Passport["parentage"] }) {
  if (!parentage?.male?.ringId && !parentage?.female?.ringId) return null;
  return <section className="living-record-section">
    <header><div><small>LINEAGE TRACE</small><h2>ร่องรอยสายสืบพันธุ์</h2></div><p>รหัสห่วงขาของพ่อแม่จากสายข้อมูลการเพาะพันธุ์ที่บันทึกไว้</p></header>
    <div className="lineage-trace">
      <article className="lineage-trace-parent"><small>FATHER RING ID</small><strong>{parentage?.male?.ringId ?? "-"}</strong></article>
      <span className="lineage-trace-link" aria-hidden="true"><i/><b>TRACE</b><i/></span>
      <article className="lineage-trace-parent"><small>MOTHER RING ID</small><strong>{parentage?.female?.ringId ?? "-"}</strong></article>
    </div>
  </section>;
}

function PublishedEvidence({ passport }: { passport: Passport }) {
  const photos = [...(passport.photos ?? [])].sort((a, b) => Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0));
  const documents = passport.documents ?? [];
  if (!photos.length && !documents.length) return null;
  return <section className="living-record-section">
    <header><div><small>SELECTIVE PUBLICATION</small><h2>ข้อมูลที่เผยแพร่</h2></div><p>แสดงเฉพาะภาพและเอกสารที่ฟาร์มเลือกเผยแพร่ไว้</p></header>
    <div className="living-record-evidence">
      {photos.length > 0 && <section><small className="living-record-eyebrow">PUBLIC PHOTOS</small><div className="public-photo-grid">{photos.map((photo, index) => <figure key={`${photo.publicUrl ?? "photo"}-${index}`}>{photo.publicUrl && <img src={photo.publicUrl} alt={photo.caption || `ภาพนก ${index + 1}`}/>}<figcaption>{photo.caption || "ภาพนกที่เผยแพร่"}</figcaption></figure>)}</div></section>}
      {documents.length > 0 && <section><small className="living-record-eyebrow">PUBLIC DOCUMENTS</small><div className="public-document-ledger">{documents.map((document, index) => <div key={`${document.documentType ?? "document"}-${index}`}><strong>{document.documentType || "เอกสาร"}</strong><span>{date(document.issuedOn)}{document.documentNumber ? ` · ${document.documentNumber}` : ""}</span></div>)}</div></section>}
    </div>
  </section>;
}

export function PublicPassportRecord({ passport }: { passport: Passport }) {
  return <article className="living-record-public">
    <header className="living-record-header"><OrangeRing variant="selected"/><div><small className="living-record-eyebrow">THE LIVING RECORD</small><h1>Bird Passport</h1><p>บันทึกข้อมูลสาธารณะที่ฟาร์มเลือกเผยแพร่สำหรับนกตัวนี้</p><em className="living-record-ring">Ring ID: {passport.ringId ?? "-"}</em></div></header>
    <section className="living-record-identity" aria-label="ข้อมูลประจำตัวนก"><div><small>Mutation</small><strong>{passport.mutation ?? "-"}</strong></div><div><small>Sex</small><strong>{displayValue(passport.sex)}</strong></div><div><small>วันฟัก</small><strong>{date(passport.hatchedOn)}</strong></div><div><small>Origin</small><strong>{displayValue(passport.origin)}</strong></div></section>
    <LineageTrace parentage={passport.parentage}/>
    <PublishedEvidence passport={passport}/>
    {passport.handoverOn && <section className="provenance-fact"><i aria-hidden="true"/><div><small className="living-record-eyebrow">PROVENANCE FACT</small><strong>วันส่งมอบ: {date(passport.handoverOn)}</strong><p>วันที่บันทึกไว้ในประวัติการส่งมอบของนก</p></div></section>}
    <footer>ข้อมูลสาธารณะนี้เป็นส่วนที่ฟาร์มเลือกเผยแพร่จากบันทึกที่เชื่อถือได้</footer>
  </article>;
}

export function PublicPassport({ publicToken }: { publicToken?: string } = {}) {
  const [token, setToken] = useState(publicToken ?? "");
  const [passport, setPassport] = useState<Passport | null>(null);
  const [message, setMessage] = useState("");
  const open = async () => { setMessage(""); setPassport(null); try { const result = await invoke("getBirdPassport", { publicToken: token }) as Passport | null; if (!result) setMessage("ไม่พบ Passport"); else setPassport(result); } catch (error) { setMessage(thaiError(error)); } };
  useEffect(() => { if (publicToken) void open(); }, [publicToken]);
  if (message) return <section className="living-record-unavailable"><small className="living-record-eyebrow">BIRD PASSPORT</small><h1>Passport นี้ไม่พร้อมใช้งาน</h1><p role="alert">ไม่พบ Passport หรือ Passport นี้ยังไม่เปิดเผย</p></section>;
  if (passport) return <PublicPassportRecord passport={passport}/>;
  return <section className="living-record-public"><header className="living-record-header"><OrangeRing variant="selected"/><div><small className="living-record-eyebrow">THE LIVING RECORD</small><h1>Bird Passport</h1><p>เปิดบันทึกสาธารณะที่ฟาร์มเลือกเผยแพร่</p></div></header>{!publicToken && <div className="living-record-manual-open"><label className="field">Public Token<input value={token} onChange={event => setToken(event.target.value)}/></label><button type="button" onClick={() => void open()}>เปิด Passport</button></div>}</section>;
}
