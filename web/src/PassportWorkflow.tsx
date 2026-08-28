import { useState } from "react";
import { OrangeRing, ProvenanceMarker } from "./bmb-design-system";
import { PassportAdmin } from "./components/PassportAdmin";
import { isoToThaiDisplay } from "./date";
import { invoke, thaiError } from "./functions";
import { displayValue } from "./presentation";
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
  if (selected && detail) return <section className="passport-control passport-control-detail">
    <header><div><small>THE LIVING RECORD</small><h2>Passport Detail</h2></div><button type="button" className="passport-control-back" onClick={() => { setSelected(null); setDetail(null); }}>เลือกนกตัวอื่น</button></header>
    <section className="passport-control-identity"><OrangeRing variant="selected"/><div><h3>{displayValue(detail.displayName)}</h3><p>Ring ID: {displayValue(detail.ringId)} · {displayValue(detail.mutation)}</p><p>วันฟัก/วันเกิด: {isoToThaiDisplay(detail.hatchedOn) || "-"} · {displayValue(detail.origin)}</p></div></section>
    <section className="living-record-identity"><div><small>เพศ</small><strong>{displayValue(selected.currentSex ?? "unknown")}</strong></div><div><small>สถานะนก</small><strong>{displayValue(detail.status)}</strong></div><div><small>พ่อ Ring ID</small><strong>{displayValue((parentage?.male as Row | undefined)?.ringId)}</strong></div><div><small>แม่ Ring ID</small><strong>{displayValue((parentage?.female as Row | undefined)?.ringId)}</strong></div></section>
    {completed && <section className="provenance-fact"><i aria-hidden="true"/><div><small>HANDOVER PROVENANCE</small><ProvenanceMarker>วันส่งมอบ: {isoToThaiDisplay(completed.handoverOn) || "-"}</ProvenanceMarker></div></section>}
    <PassportAdmin birdId={String(detail.birdId)} passportStatus={detail.passportStatus} publicToken={detail.publicToken} photos={detail.photos} documents={detail.documents} onChanged={refetch}/>
    {error && <p role="alert">{error}</p>}
  </section>;
  return <section className="passport-control passport-control-selector">
    <header><small>PUBLICATION CONTROL</small><h2>เลือกนกสำหรับ Passport</h2><p>ค้นหา Bird ที่ต้องการตรวจสอบหรือกำหนดขอบเขตการเผยแพร่</p></header>
    <label className="passport-control-search">ค้นหาจาก Ring ID หรือชื่อนก<input aria-label="ค้นหานกสำหรับ Passport" value={query} onChange={event => setQuery(event.target.value)}/></label>
    <div className="passport-control-list">{matches.map(bird => <button type="button" className="passport-control-bird" key={bird.birdId} onClick={() => void choose(bird)}><OrangeRing variant="compact"/><span><strong>{displayValue(bird.displayName)}</strong><em>Ring ID: {displayValue(bird.ringId)}</em><small>{displayValue(bird.currentSex)} · {displayValue(bird.mutation)}</small></span><i>{displayValue(bird.passportStatus)}</i></button>)}</div>
    {error && <p role="alert">{error}</p>}
  </section>;
}
