import { useEffect, useState } from "react";
import { OrangeRing } from "../bmb-design-system";
import { isoToThaiDisplay } from "../date";
import { invoke, thaiError } from "../functions";
import { displayOrigin, displayValue } from "../presentation";
import "../Passport.css";

type PublicPhoto = { publicUrl?: string | null; caption?: string | null; sortOrder?: number | null };
type Passport = {
  ringId?: string; mutation?: string | null; hatchedOn?: string | null; sex?: string; origin?: string;
  handoverOn?: string | null; passportStatus?: string;
  parentage?: { male?: { ringId?: string } | null; female?: { ringId?: string } | null } | null;
  photos?: PublicPhoto[];
  documents?: Array<{ documentType?: string; issuedOn?: string; documentNumber?: string }>;
};

const date = (value: unknown) => isoToThaiDisplay(typeof value === "string" ? value : null) || "-";

function LineageTrace({ parentage }: { parentage: Passport["parentage"] }) {
  return <section className="living-record-section passport-family">
    <header><div><small>FAMILY & LINEAGE</small><h2>ครอบครัวของฉัน</h2></div></header>
    <div className="lineage-trace">
      <article className="lineage-trace-parent"><small>พ่อ</small><strong>{parentage?.male?.ringId ?? "ไม่ทราบข้อมูล"}</strong><span>{parentage?.male?.ringId ? "Ring ID" : "ยังไม่มีข้อมูลสายพ่อ"}</span></article>
      <article className="lineage-trace-bird"><span aria-hidden="true">♪</span><strong>นกตัวนี้</strong></article>
      <article className="lineage-trace-parent"><small>แม่</small><strong>{parentage?.female?.ringId ?? "ไม่ทราบข้อมูล"}</strong><span>{parentage?.female?.ringId ? "Ring ID" : "ยังไม่มีข้อมูลสายแม่"}</span></article>
    </div>
  </section>;
}

function PublishedEvidence({ passport, heroPhoto }: { passport: Passport; heroPhoto?: PublicPhoto }) {
  const photos = [...(passport.photos ?? [])].sort((a, b) => Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0)).filter(photo => photo !== heroPhoto);
  const documents = passport.documents ?? [];
  if (!photos.length && !documents.length) return null;
  return <section className="living-record-section">
    <header><div><small>FROM THE FARM RECORD</small><h2>ภาพและเอกสารที่เผยแพร่</h2></div></header>
    <div className="living-record-evidence">
      {photos.length > 0 && <section><small className="living-record-eyebrow">PUBLIC PHOTOS</small><div className="public-photo-grid">{photos.map((photo, index) => <figure key={`${photo.publicUrl ?? "photo"}-${index}`}>{photo.publicUrl && <img src={photo.publicUrl} alt={photo.caption || `ภาพนก ${index + 1}`}/>}<figcaption>{photo.caption || "ภาพนกที่เผยแพร่"}</figcaption></figure>)}</div></section>}
      {documents.length > 0 && <section><small className="living-record-eyebrow">PUBLIC DOCUMENTS</small><div className="public-document-ledger">{documents.map((document, index) => <div key={`${document.documentType ?? "document"}-${index}`}><strong>{document.documentType || "เอกสาร"}</strong><span>{date(document.issuedOn)}{document.documentNumber ? ` · ${document.documentNumber}` : ""}</span></div>)}</div></section>}
    </div>
  </section>;
}

export function PublicPassportRecord({ passport }: { passport: Passport }) {
  const heroPhoto = [...(passport.photos ?? [])].sort((a, b) => Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0))[0];
  return <article className="living-record-public">
    <header className="living-record-header"><div className="living-record-portrait">{heroPhoto?.publicUrl ? <img src={heroPhoto.publicUrl} alt={heroPhoto.caption || "ภาพนกในพาสปอร์ต"}/> : <div className="passport-portrait-placeholder" aria-hidden="true"><OrangeRing variant="selected"/><span>♪</span></div>}</div><div className="living-record-title"><small className="living-record-eyebrow">BIRDS MY BOSS</small><h1>Bird Passport</h1><p>บัตรประจำตัวนกจากระบบฟาร์ม</p><em className="living-record-ring">Ring ID: {passport.ringId ?? "-"}</em></div><div className="passport-hero-leaves" aria-hidden="true"><i/><i/></div></header>
    <section className="living-record-identity" aria-label="ข้อมูลประจำตัวนก"><div><span aria-hidden="true">◌</span><small>Mutation / สี</small><strong>{passport.mutation ?? "-"}</strong></div><div><span aria-hidden="true">◇</span><small>เพศ</small><strong>{displayValue(passport.sex)}</strong></div><div><span aria-hidden="true">○</span><small>วันฟัก / วันเกิด</small><strong>{date(passport.hatchedOn)}</strong></div><div><span aria-hidden="true">⌂</span><small>แหล่งที่มา</small><strong>{displayOrigin(passport.origin)}</strong></div></section>
    <LineageTrace parentage={passport.parentage}/>
    {(passport.hatchedOn || passport.handoverOn) && <section className="living-record-section passport-story"><header><div><small>MY STORY</small><h2>เรื่องราวของฉัน</h2></div></header><div className="passport-timeline">{passport.hatchedOn && <article><i aria-hidden="true"/><div><small>วันฟัก / วันเกิด</small><strong>{date(passport.hatchedOn)}</strong></div></article>}{passport.handoverOn && <article><i aria-hidden="true"/><div><small>การส่งมอบ</small><strong>วันส่งมอบ: {date(passport.handoverOn)}</strong></div></article>}</div></section>}
    <PublishedEvidence passport={passport} heroPhoto={heroPhoto}/>
    <footer><strong>Birds My Boss</strong><span>ข้อมูลพาสปอร์ตจากระบบฟาร์ม</span><small>แสดงเฉพาะข้อมูลที่ฟาร์มเลือกเผยแพร่</small></footer>
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
  return <section className="living-record-public passport-welcome"><header className="living-record-header"><div className="passport-portrait-placeholder" aria-hidden="true"><OrangeRing variant="selected"/><span>♪</span></div><div><small className="living-record-eyebrow">BIRDS MY BOSS</small><h1>Bird Passport</h1><p>เปิดบัตรประจำตัวนกที่ฟาร์มเลือกเผยแพร่</p></div></header>{!publicToken && <div className="living-record-manual-open"><label className="field">Public Token<input value={token} onChange={event => setToken(event.target.value)}/></label><button type="button" onClick={() => void open()}>เปิด Passport</button></div>}</section>;
}
