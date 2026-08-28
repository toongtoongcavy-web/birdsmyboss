import { FormEvent, useEffect, useState } from "react";
import { DateInput } from "./DateInput";
import { isoToThaiDisplay } from "./date";
import { invoke, thaiError } from "./functions";
import { displayValue } from "./presentation";
import { EmptyState } from "./ui";

type Row = Record<string, any>;

export function PriceHistory({ birdId, onSaved }: { birdId: string; onSaved: () => Promise<void> }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [amount, setAmount] = useState("");
  const [effectiveOn, setEffectiveOn] = useState("");
  const [kind, setKind] = useState("list");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const load = async () => {
    try { setRows(await invoke("listBirdPriceHistory", { birdId }) as Row[]); }
    catch (error) { setMessage(thaiError(error)); }
  };
  useEffect(() => { void load(); }, [birdId]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const numeric = Number(amount);
    if (!Number.isFinite(numeric) || numeric < 0 || !effectiveOn) { setMessage("กรุณากรอกราคาและวันที่ให้ถูกต้อง"); return; }
    setBusy(true);
    try {
      await invoke("createPriceHistory", { birdId, amount: numeric, currency: "THB", effectiveOn, kind, ...(notes.trim() ? { notes: notes.trim() } : {}) });
      setAmount(""); setEffectiveOn(""); setNotes(""); setMessage("บันทึกราคาสำเร็จ");
      await Promise.all([load(), onSaved()]);
    } catch (error) { setMessage(thaiError(error)); }
    finally { setBusy(false); }
  };
  return <section className="history-ledger" aria-label="ประวัติราคา">
    <header><h3>ประวัติราคา: {rows.length}</h3><p>บันทึกราคาเชิงประวัติ ไม่ใช่ราคาที่ระบบเลือกให้อัตโนมัติ</p></header>
    {rows.length ? rows.map((row, index) => <article key={String(row.priceHistoryId)}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{displayValue(row.amount)} {displayValue(row.currency)}</strong><small>{displayValue(row.kind)} · มีผล {isoToThaiDisplay(row.effectiveOn) || "-"}{row.validUntil ? ` ถึง ${isoToThaiDisplay(row.validUntil) || "-"}` : ""}</small>{row.notes ? <small>{displayValue(row.notes)}</small> : null}</div></article>) : <EmptyState title="ยังไม่มีประวัติราคา" description="การไม่มีราคาไม่ได้หมายถึงให้เปล่าหรือราคาเป็นศูนย์"/>}
    <form className="card" onSubmit={submit}>
      <h4>บันทึกประวัติราคา</h4>
      <label className="field">ราคา (THB) *<input required type="number" min="0" step="any" aria-label="ราคาประวัติ" value={amount} onChange={event => setAmount(event.target.value)} /></label>
      <DateInput label="วันที่มีผล" required value={effectiveOn} onChange={value => setEffectiveOn(value ?? "")}/>
      <label className="field">ประเภท *<select aria-label="ประเภทราคา" value={kind} onChange={event => setKind(event.target.value)}><option value="list">list</option><option value="offer">offer</option><option value="final">final</option></select></label>
      <label className="field">หมายเหตุ<input aria-label="หมายเหตุราคา" value={notes} onChange={event => setNotes(event.target.value)} /></label>
      <button disabled={busy}>{busy ? "กำลังบันทึก…" : "บันทึกราคา"}</button>
      {message ? <p role="status">{message}</p> : null}
    </form>
  </section>;
}
