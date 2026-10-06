import { FormEvent, useEffect, useMemo, useState } from "react";
import { DateInput } from "./DateInput";
import { invoke, thaiError } from "./functions";
import { BirdStatusBadge, PageHeader, SectionCard } from "./ui";
import "./MvpCages.css";

type Row = Record<string, any>;

const cageTypeLabel: Record<string, string> = {
  breeding: "กรงเพาะพันธุ์",
  holding: "กรงรวม / พักนก",
  individual: "กรงเดี่ยว",
};
const cageStatusLabel: Record<string, string> = {
  active: "พร้อมใช้งาน",
  maintenance: "ปิดปรับปรุง",
  inactive: "เลิกใช้งาน",
};
const sexLabel: Record<string, string> = { male: "ตัวผู้", female: "ตัวเมีย", unknown: "ไม่ทราบเพศ" };
const terminalBirdStatuses = new Set(["sold", "given_away", "deceased", "lost"]);
const birdLabel = (bird?: Row | null) => bird ? `${bird.ringId ?? "-"} — ${bird.displayName ?? "-"}` : "-";
const cageLabel = (cage?: Row | null) => cage ? `${cage.code ?? "-"} — ${cage.name ?? "-"}` : "ยังไม่ได้จัดกรง";
const currentCageLabel = (bird?: Row | null) => bird?.currentCageCode ? `${bird.currentCageCode} — ${bird.currentCageName ?? ""}` : "ยังไม่ได้จัดกรง";

export function MvpCages() {
  const [cages, setCages] = useState<Row[]>([]);
  const [birds, setBirds] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const refresh = async () => {
    setLoading(true); setMessage("");
    try {
      const [nextCages, nextBirds] = await Promise.all([
        invoke("listMvpCages", {}) as Promise<Row[]>,
        invoke("listMvpBirds", {}) as Promise<Row[]>,
      ]);
      setCages(nextCages); setBirds(nextBirds);
    } catch (error) { setMessage(thaiError(error)); }
    finally { setLoading(false); }
  };
  useEffect(() => { void refresh(); }, []);
  const currentFarmBirds = birds.filter(bird => !terminalBirdStatuses.has(String(bird.status)));
  const occupiedCages = cages.filter(cage => Number(cage.occupancyCount ?? 0) > 0).length;

  return <div className="cage-workspace">
    <div className="cage-page-header">
      <PageHeader title="ข้อมูลกรง" subtitle="สร้างกรง จัดนกเข้ากรง และจับคู่โดยให้ตำแหน่งนกกับกรงตรงกันเสมอ" />
      <div className="cage-summary" aria-label="สรุปข้อมูลกรง">
        <SummaryCard label="กรงทั้งหมด" value={cages.length} />
        <SummaryCard label="กรงว่าง" value={cages.length - occupiedCages} />
        <SummaryCard label="กรงที่มีนก" value={occupiedCages} />
      </div>
    </div>
    {message && <p role="alert">{message}</p>}
    {loading && <p className="muted">กำลังโหลดข้อมูล…</p>}
    <section className="cage-action-grid" aria-label="การจัดการกรง">
        <CreateCageForm refresh={refresh} />
        <CreateBirdInCageForm cages={cages} refresh={refresh} />
        <MoveBirdForm birds={currentFarmBirds} cages={cages} refresh={refresh} />
    </section>
    <PairInCageForm birds={currentFarmBirds} cages={cages} refresh={refresh} />
    <div className="cage-registry-grid">
      <CageList cages={cages} />
      <BirdCageList birds={currentFarmBirds} />
    </div>
  </div>;
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return <article className="cage-summary-card"><span>{label}</span><strong>{value}</strong></article>;
}

function ActionHeading({ marker, title, subtitle }: { marker: string; title: string; subtitle: string }) {
  return <header className="cage-action-heading"><span aria-hidden="true">{marker}</span><div><h3>{title}</h3><p>{subtitle}</p></div></header>;
}

function CreateCageForm({ refresh }: { refresh: () => Promise<void> }) {
  const [code, setCode] = useState(""); const [name, setName] = useState(""); const [type, setType] = useState("breeding"); const [status, setStatus] = useState("active"); const [capacity, setCapacity] = useState(""); const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  const submit = async (event: FormEvent) => { event.preventDefault(); setBusy(true); setMessage(""); try {
    await invoke("createMvpCage", { code, name, type, status, ...(capacity ? { capacity: Number(capacity) } : {}), ...(notes.trim() ? { notes: notes.trim() } : {}) });
    setCode(""); setName(""); setCapacity(""); setNotes(""); setMessage("สร้างกรงเรียบร้อย"); await refresh();
  } catch (error) { setMessage(thaiError(error)); } finally { setBusy(false); } };
  return <form className="card cage-action-card" onSubmit={submit}><ActionHeading marker="01" title="สร้างกรง" subtitle="กำหนดพื้นที่และความจุของกรงในฟาร์ม" />
    <div className="cage-form-grid">
      <label className="field">รหัสกรง *<input required value={code} onChange={e => setCode(e.target.value)} placeholder="เช่น A1 หรือ HOLD-01" /></label>
      <label className="field">ชื่อกรง *<input required value={name} onChange={e => setName(e.target.value)} placeholder="เช่น กรง A1 / กรงรวม 01" /></label>
      <label className="field">ประเภทกรง *<select value={type} onChange={e => setType(e.target.value)}><option value="breeding">กรงเพาะพันธุ์</option><option value="holding">กรงรวม / พักนก</option><option value="individual">กรงเดี่ยว</option></select></label>
      <label className="field">สถานะกรง *<select value={status} onChange={e => setStatus(e.target.value)}><option value="active">พร้อมใช้งาน</option><option value="maintenance">ปิดปรับปรุง</option><option value="inactive">เลิกใช้งาน</option></select></label>
      <label className="field">ความจุ (จำนวนตัว)<input type="number" min="1" value={capacity} onChange={e => setCapacity(e.target.value)} placeholder={type === "breeding" ? "เช่น 2" : "ไม่บังคับ"} /></label>
      <label className="field">หมายเหตุ<textarea value={notes} onChange={e => setNotes(e.target.value)} /></label>
    </div>
    <div className="cage-card-footer"><button disabled={busy}>{busy ? "กำลังบันทึก…" : "สร้างกรง"}</button>{message && <p role="status">{message}</p>}</div>
  </form>;
}

function CreateBirdInCageForm({ cages, refresh }: { cages: Row[]; refresh: () => Promise<void> }) {
  const activeCages = cages.filter(cage => cage.status === "active");
  const [ringId, setRingId] = useState(""); const [displayName, setDisplayName] = useState(""); const [mutation, setMutation] = useState(""); const [sex, setSex] = useState("unknown"); const [cageId, setCageId] = useState(""); const [date, setDate] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  const submit = async (event: FormEvent) => { event.preventDefault(); if (!date) { setMessage("กรุณาระบุวันที่รับนก/จัดเข้ากรง"); return; } setBusy(true); setMessage(""); try {
    const result = await invoke("createExternalBirdInCageMvp", { ringId, displayName, origin: "external", cageId, movedOn: date, acquiredOn: date, ...(mutation.trim() ? { mutation: mutation.trim() } : {}) }) as Row;
    await invoke("recordSexHistory", { birdId: result.birdId, sex, determinedOn: date, method: "unknown" });
    setRingId(""); setDisplayName(""); setMutation(""); setSex("unknown"); setCageId(""); setDate(undefined); setMessage("เพิ่มนกและจัดเข้ากรงเรียบร้อย"); await refresh();
  } catch (error) { setMessage(thaiError(error)); } finally { setBusy(false); } };
  return <form className="card cage-action-card" onSubmit={submit}><ActionHeading marker="02" title="เพิ่มนกพร้อมระบุกรง" subtitle="บันทึกนกจากภายนอกพร้อมตำแหน่งเริ่มต้น" />
    <div className="cage-form-grid">
      <label className="field">รหัสห่วงขา *<input required value={ringId} onChange={e => setRingId(e.target.value)} /></label>
      <label className="field">ชื่อ *<input required value={displayName} onChange={e => setDisplayName(e.target.value)} /></label>
      <label className="field">มิวเทชัน / สี<input value={mutation} onChange={e => setMutation(e.target.value)} /></label>
      <label className="field">เพศ *<select value={sex} onChange={e => setSex(e.target.value)}><option value="male">ตัวผู้</option><option value="female">ตัวเมีย</option><option value="unknown">ไม่ทราบเพศ</option></select></label>
      <label className="field">กรงปัจจุบัน *<select required value={cageId} onChange={e => setCageId(e.target.value)}><option value="" disabled>เลือกกรง</option>{activeCages.map(cage => <option key={cage.cageId} value={cage.cageId}>{cageLabel(cage)}</option>)}</select></label>
      <DateInput label="วันที่รับนก / จัดเข้ากรง" required value={date} onChange={setDate} />
    </div>
    <div className="cage-card-footer"><button disabled={busy || activeCages.length === 0}>{busy ? "กำลังบันทึก…" : "เพิ่มนกและระบุกรง"}</button>{activeCages.length === 0 && <p className="muted">กรุณาสร้างกรงที่พร้อมใช้งานก่อน</p>}{message && <p role="status">{message}</p>}</div>
  </form>;
}

function MoveBirdForm({ birds, cages, refresh }: { birds: Row[]; cages: Row[]; refresh: () => Promise<void> }) {
  const activeCages = cages.filter(cage => cage.status === "active"); const [birdId, setBirdId] = useState(""); const [cageId, setCageId] = useState(""); const [date, setDate] = useState<string | undefined>(); const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  const selectedBird = birds.find(bird => bird.birdId === birdId);
  const submit = async (event: FormEvent) => { event.preventDefault(); if (!date) { setMessage("กรุณาระบุวันที่ย้ายกรง"); return; } setBusy(true); setMessage(""); try { await invoke("assignBirdToCageMvp", { birdId, cageId, movedOn: date, reason: "ย้ายกรง" }); setMessage("อัปเดตกรงปัจจุบันเรียบร้อย"); setBirdId(""); setCageId(""); setDate(undefined); await refresh(); } catch (error) { setMessage(thaiError(error)); } finally { setBusy(false); } };
  return <form className="card cage-action-card" onSubmit={submit}><ActionHeading marker="03" title="การจัดนกเข้ากรง" subtitle="ย้ายตำแหน่งนกไปยังกรงปลายทาง" />
    <label className="field">นก *<select required value={birdId} onChange={e => setBirdId(e.target.value)}><option value="" disabled>เลือกนก</option>{birds.map(bird => <option key={bird.birdId} value={bird.birdId}>{birdLabel(bird)} · {currentCageLabel(bird)}</option>)}</select></label>
    {selectedBird && <p className="muted">กรงปัจจุบัน: <b>{currentCageLabel(selectedBird)}</b></p>}
    <label className="field">กรงปลายทาง *<select required value={cageId} onChange={e => setCageId(e.target.value)}><option value="" disabled>เลือกกรงปลายทาง</option>{activeCages.map(cage => <option key={cage.cageId} value={cage.cageId}>{cageLabel(cage)}</option>)}</select></label>
    <DateInput label="วันที่ย้ายกรง" required value={date} onChange={setDate} />
    <div className="cage-card-footer"><button disabled={busy}>{busy ? "กำลังบันทึก…" : "จัดนกเข้ากรง"}</button>{message && <p role="status">{message}</p>}</div>
  </form>;
}

function PairInCageForm({ birds, cages, refresh }: { birds: Row[]; cages: Row[]; refresh: () => Promise<void> }) {
  const males = birds.filter(bird => bird.currentSex === "male" && bird.status === "active"); const females = birds.filter(bird => bird.currentSex === "female" && bird.status === "active"); const breedingCages = cages.filter(cage => cage.status === "active" && (!cage.type || cage.type === "breeding"));
  const [maleId, setMaleId] = useState(""); const [femaleId, setFemaleId] = useState(""); const [cageId, setCageId] = useState(""); const [date, setDate] = useState<string | undefined>(); const [name, setName] = useState(""); const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  const male = useMemo(() => birds.find(bird => bird.birdId === maleId), [birds, maleId]); const female = useMemo(() => birds.find(bird => bird.birdId === femaleId), [birds, femaleId]); const cage = useMemo(() => cages.find(row => row.cageId === cageId), [cages, cageId]);
  const submit = async (event: FormEvent) => { event.preventDefault(); if (!date) { setMessage("กรุณาระบุวันที่เริ่มจับคู่"); return; } setBusy(true); setMessage(""); try { const result = await invoke("createActivePairInCageMvp", { maleBirdId: maleId, femaleBirdId: femaleId, cageId, startedOn: date, ...(name.trim() ? { name: name.trim() } : {}) }) as Row; setMessage(result.kinship?.status === "warning" ? "สร้างคู่และจัดเข้ากรงเรียบร้อย — ระบบพบข้อควรตรวจสอบด้านเครือญาติ" : "สร้างคู่และจัดเข้ากรงเรียบร้อย"); setMaleId(""); setFemaleId(""); setCageId(""); setDate(undefined); setName(""); await refresh(); } catch (error) { setMessage(thaiError(error)); } finally { setBusy(false); } };
  return <SectionCard title="จับคู่ผสมพันธุ์ + กรงคู่ผสมพันธุ์" subtitle="สร้างคู่และจัดตำแหน่งทั้งสองตัวให้ตรงกับกรงเพาะพันธุ์" className="cage-pair-card"><form onSubmit={submit}>
    <p className="muted">เมื่อยืนยัน ระบบจะย้ายนกที่จำเป็นเข้ากรงปลายทางและสร้างคู่ในรายการเดียวกัน เพื่อไม่ให้เกิดคู่ที่อยู่คนละกรง</p>
    <div className="cage-pair-grid">
      <label className="field">พ่อ / ตัวผู้ *<select required value={maleId} onChange={e => setMaleId(e.target.value)}><option value="" disabled>เลือกตัวผู้</option>{males.map(bird => <option key={bird.birdId} value={bird.birdId}>{birdLabel(bird)} · {currentCageLabel(bird)}</option>)}</select></label>
      <label className="field">แม่ / ตัวเมีย *<select required value={femaleId} onChange={e => setFemaleId(e.target.value)}><option value="" disabled>เลือกตัวเมีย</option>{females.map(bird => <option key={bird.birdId} value={bird.birdId}>{birdLabel(bird)} · {currentCageLabel(bird)}</option>)}</select></label>
      <label className="field">กรงคู่ผสมพันธุ์ *<select required value={cageId} onChange={e => setCageId(e.target.value)}><option value="" disabled>เลือกกรงเพาะพันธุ์</option>{breedingCages.map(row => <option key={row.cageId} value={row.cageId}>{cageLabel(row)} · {row.occupancyCount ?? 0} ตัว</option>)}</select></label>
      <label className="field">ชื่อคู่<input value={name} onChange={e => setName(e.target.value)} placeholder="ไม่บังคับ" /></label>
      <DateInput label="วันที่เริ่มจับคู่" required value={date} onChange={setDate} />
    </div>
    {male && female && cage && <div className="card" style={{ marginTop: 12 }}><b>ตรวจสอบก่อนยืนยัน</b><p>{birdLabel(male)}: {currentCageLabel(male)} → {cageLabel(cage)}</p><p>{birdLabel(female)}: {currentCageLabel(female)} → {cageLabel(cage)}</p></div>}
    <button disabled={busy || !male || !female || !cage}>{busy ? "กำลังบันทึก…" : "บันทึกการจับคู่"}</button>{message && <p role="status">{message}</p>}
  </form></SectionCard>;
}

function CageList({ cages }: { cages: Row[] }) {
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const filtered = cages.filter(cage => {
    const query = search.trim().toLocaleLowerCase("th");
    return (!query || `${cage.code ?? ""} ${cage.name ?? ""}`.toLocaleLowerCase("th").includes(query))
      && (!type || cage.type === type) && (!status || cage.status === status);
  });
  return <SectionCard title="รายการกรง" subtitle="ค้นหาและตรวจสอบความพร้อมของกรง" className="cage-registry-panel">
    <div className="compact-filter-bar">
      <label>ค้นหากรง<input aria-label="ค้นหากรง" value={search} onChange={event => setSearch(event.target.value)} placeholder="รหัสหรือชื่อกรง" /></label>
      <label>ประเภท<select aria-label="กรองประเภทกรง" value={type} onChange={event => setType(event.target.value)}><option value="">ทุกประเภท</option>{Object.entries(cageTypeLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>สถานะ<select aria-label="กรองสถานะกรง" value={status} onChange={event => setStatus(event.target.value)}><option value="">ทุกสถานะ</option>{Object.entries(cageStatusLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    </div>
    {filtered.length ? <div className="cage-table-wrap"><table className="cage-data-table"><thead><tr><th>รหัสกรง</th><th>ชื่อกรง</th><th>ประเภทกรง</th><th>ความจุ</th><th>สถานะ</th><th>นกในกรง</th><th>การจัดการ</th></tr></thead><tbody>{filtered.map(cage => { const occupancy = Number(cage.occupancyCount ?? 0); const full = typeof cage.capacity === "number" && occupancy >= cage.capacity; return <tr key={cage.cageId}><td data-label="รหัสกรง"><b>{cage.code ?? "-"}</b></td><td data-label="ชื่อกรง">{cage.name ?? "-"}</td><td data-label="ประเภทกรง">{cageTypeLabel[cage.type] ?? cage.type ?? "-"}</td><td data-label="ความจุ">{cage.capacity ?? "ไม่จำกัด"}</td><td data-label="สถานะ"><span className={`cage-status cage-status-${cage.status}`}>{cageStatusLabel[cage.status] ?? cage.status ?? "-"}</span></td><td data-label="นกในกรง"><span className={`occupancy-badge ${full ? "is-full" : occupancy ? "is-occupied" : "is-empty"}`}>{occupancy}{cage.capacity ? ` / ${cage.capacity}` : ""} ตัว</span></td><td data-label="การจัดการ"><span className="muted">—</span></td></tr>; })}</tbody></table></div> : <p className="muted">{cages.length ? "ไม่พบกรงที่ตรงกับตัวกรอง" : "ยังไม่มีข้อมูลกรง"}</p>}
  </SectionCard>;
}

function BirdCageList({ birds }: { birds: Row[] }) {
  const [search, setSearch] = useState("");
  const [cage, setCage] = useState("");
  const cageOptions = Array.from(new Set(birds.filter(bird => bird.currentCageCode).map(bird => String(bird.currentCageCode)))).sort();
  const filtered = birds.filter(bird => {
    const query = search.trim().toLocaleLowerCase("th");
    return (!query || `${bird.displayName ?? ""} ${bird.ringId ?? ""}`.toLocaleLowerCase("th").includes(query)) && (!cage || bird.currentCageCode === cage);
  });
  return <SectionCard title="นกและกรงปัจจุบัน" subtitle="ตำแหน่งล่าสุดของนกที่ยังอยู่ในฟาร์ม" className="bird-cage-panel">
    <div className="compact-filter-bar bird-filter-bar">
      <label>ค้นหานก<input aria-label="ค้นหานกในกรง" value={search} onChange={event => setSearch(event.target.value)} placeholder="ชื่อหรือรหัสห่วงขา" /></label>
      <label>กรงปัจจุบัน<select aria-label="กรองกรงปัจจุบัน" value={cage} onChange={event => setCage(event.target.value)}><option value="">ทุกกรง</option>{cageOptions.map(code => <option key={code} value={code}>{code}</option>)}</select></label>
    </div>
    {filtered.length ? <div className="cage-table-wrap"><table className="cage-data-table bird-data-table"><thead><tr><th>ชื่อนก</th><th>Ring ID</th><th>เพศ</th><th>กรงปัจจุบัน</th><th>สถานะ</th></tr></thead><tbody>{filtered.map(bird => <tr key={bird.birdId}><td data-label="ชื่อนก"><b>{bird.displayName ?? "-"}</b></td><td data-label="Ring ID">{bird.ringId ?? "-"}</td><td data-label="เพศ">{sexLabel[bird.currentSex] ?? bird.currentSex ?? "-"}</td><td data-label="กรงปัจจุบัน"><b>{currentCageLabel(bird)}</b></td><td data-label="สถานะ"><BirdStatusBadge status={bird.status} /></td></tr>)}</tbody></table></div> : <p className="muted">{birds.length ? "ไม่พบนกที่ตรงกับตัวกรอง" : "ยังไม่มีข้อมูลนก"}</p>}
  </SectionCard>;
}
