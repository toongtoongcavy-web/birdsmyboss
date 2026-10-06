import { useState } from "react";
import { OrangeRing, ProvenanceMarker } from "./bmb-design-system";
import { PassportAdmin } from "./components/PassportAdmin";
import { isoToThaiDisplay } from "./date";
import { invoke, thaiError } from "./functions";
import { displayOrigin, displayValue } from "./presentation";
import { birdVisualClass } from "./ui";
import "./Passport.css";

type Row = Record<string, any>;

export function PassportWorkflow({ birds, handovers, onRefresh }: { birds: Row[]; handovers: Row[]; onRefresh: () => Promise<void> }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Row | null>(null);
  const [detail, setDetail] = useState<Row | null>(null);
  const [error, setError] = useState("");
  const normalized = query.trim().toLocaleLowerCase();
  const matches = birds.filter(bird => !normalized || String(bird.ringId ?? "").toLocaleLowerCase().includes(normalized) || String(bird.displayName ?? "").toLocaleLowerCase().includes(normalized)).slice(0, 12);
  const read = async (bird: Row) => { const result = await invoke("getBirdDetails", { birdId: bird.birdId }) as Row; setDetail(result); return result; };
  const choose = async (bird: Row) => { setSelected(bird); setError(""); try { await read(bird); } catch (caught) { setError(thaiError(caught)); } };
  const refetch = async () => { if (!selected) return; await onRefresh(); await read(selected); };
  const completed = selected ? handovers.find(handover => handover.birdId === selected.birdId && handover.status === "completed") : null;
  const parentage = detail?.parentage as Row | null | undefined;
  const statusCounts = {
    published: birds.filter(bird => bird.passportStatus === "published").length,
    draft: birds.filter(bird => !bird.passportStatus || bird.passportStatus === "draft").length,
    disabled: birds.filter(bird => bird.passportStatus === "disabled").length,
  };
  return <section className="passport-studio">
    <header className="passport-studio-header"><div><span className="eyebrow">BIRDS MY BOSS</span><h1>พาสปอร์ตนก</h1><p>สร้างและจัดการข้อมูลพาสปอร์ตของนกในฟาร์ม</p></div><div className="passport-studio-motif" aria-hidden="true"><b>●</b><i/><i/></div></header>
    <section className="passport-studio-summary" aria-label="สรุปสถานะพาสปอร์ต"><article><span>นกทั้งหมด</span><strong>{birds.length}</strong></article><article><span>เผยแพร่แล้ว</span><strong>{statusCounts.published}</strong></article><article><span>แบบร่าง</span><strong>{statusCounts.draft}</strong></article><article><span>ปิดเผยแพร่</span><strong>{statusCounts.disabled}</strong></article></section>
    {selected && detail ? <section className="passport-control passport-control-detail">
      <header><div><small>PASSPORT STUDIO</small><h2>ตัวอย่างพาสปอร์ต</h2></div><button type="button" className="passport-control-back" onClick={() => { setSelected(null); setDetail(null); }}>เลือกนกตัวอื่น</button></header>
      <section className={`passport-admin-preview ${birdVisualClass(detail.status)}`}>
        <div className="passport-admin-portrait" aria-hidden="true"><OrangeRing variant="selected"/><span>Birds<br/>My Boss</span></div>
        <div className="passport-admin-identity"><small>BIRD PASSPORT</small><h3>{displayValue(detail.displayName)}</h3><em>Ring ID: {displayValue(detail.ringId)}</em><p>{displayValue(detail.mutation)} · {displayOrigin(detail.origin)}</p></div>
        <div className="passport-admin-facts"><div><small>เพศ</small><strong>{displayValue(selected.currentSex ?? "unknown")}</strong></div><div><small>สถานะนก</small><strong>{displayValue(detail.status)}</strong></div><div><small>วันฟัก / วันเกิด</small><strong>{isoToThaiDisplay(detail.hatchedOn) || "-"}</strong></div><div><small>สถานะพาสปอร์ต</small><strong>{displayValue(detail.passportStatus ?? "draft")}</strong></div></div>
      </section>
      <section className="passport-admin-lineage" aria-label="ข้อมูลพ่อแม่นก"><article><small>พ่อ</small><strong>{displayValue((parentage?.male as Row | undefined)?.displayName)}</strong><span>Ring ID: {displayValue((parentage?.male as Row | undefined)?.ringId)}</span></article><i aria-hidden="true"/><article><small>แม่</small><strong>{displayValue((parentage?.female as Row | undefined)?.displayName)}</strong><span>Ring ID: {displayValue((parentage?.female as Row | undefined)?.ringId)}</span></article></section>
      {completed && <section className="provenance-fact"><i aria-hidden="true"/><div><small>ประวัติการส่งมอบ</small><ProvenanceMarker>วันส่งมอบ: {isoToThaiDisplay(completed.handoverOn) || "-"}</ProvenanceMarker></div></section>}
      <PassportAdmin birdId={String(detail.birdId)} passportStatus={detail.passportStatus} publicToken={detail.publicToken} photos={detail.photos} documents={detail.documents} onChanged={refetch}/>
      {error && <p role="alert">{error}</p>}
    </section> : <section className="passport-control passport-control-selector">
      <header><small>เลือกนก</small><h2>จัดการพาสปอร์ต</h2><p>ค้นหาด้วยชื่อนกหรือ Ring ID แล้วเลือกพาสปอร์ตที่ต้องการจัดการ</p></header>
      <label className="passport-control-search"><span>ค้นหานก</span><input aria-label="ค้นหานกสำหรับ Passport" placeholder="ชื่อนก หรือ Ring ID" value={query} onChange={event => setQuery(event.target.value)}/></label>
      <div className="passport-control-list">{matches.map(bird => <button type="button" className={`passport-control-bird ${birdVisualClass(bird.status)}`} key={bird.birdId} onClick={() => void choose(bird)}><OrangeRing variant="compact"/><span><strong>{displayValue(bird.displayName)}</strong><em>Ring ID: {displayValue(bird.ringId)}</em><small>{displayValue(bird.currentSex)} · {displayValue(bird.status)} · {displayValue(bird.mutation)}</small></span><i>{displayValue(bird.passportStatus)}</i></button>)}</div>
      {matches.length === 0 && <div className="passport-control-empty">ไม่พบนกที่ตรงกับคำค้นหา</div>}
      {error && <p role="alert">{error}</p>}
    </section>}
  </section>;
}
