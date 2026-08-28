import { FormEvent, ReactNode, useMemo, useState } from "react";
import { invoke, thaiError } from "./functions";
import { isoToThaiDisplay } from "./date";
import { displayValue } from "./presentation";
import { OrangeRing } from "./bmb-design-system";
import { EmptyState, StatusBadge } from "./ui";
import "./Customers.css";

type Row = Record<string, any>;

function BirdReference({ bird }: { bird?: Row }) {
  return <span className="keeper-bird-reference"><OrangeRing variant="compact"/><span><small>BIRD IDENTITY</small><strong>{displayValue(bird?.displayName)}</strong><em>Ring ID: {displayValue(bird?.ringId)}</em></span></span>;
}

function ContactLedger({ customer }: { customer: Row }) {
  return <dl className="keeper-contact-ledger"><div><dt>โทรศัพท์</dt><dd>{displayValue(customer.phone)}</dd></div><div><dt>อีเมล</dt><dd>{displayValue(customer.email)}</dd></div></dl>;
}

function CustomerDetail({ customer, birds, onBack }: { customer: Row; birds: Row[]; onBack: () => void }) {
  const birdOf = (birdId: unknown) => birds.find(bird => bird.birdId === birdId);
  const reservations = Array.isArray(customer.reservations) ? customer.reservations as Row[] : [];
  const sales = Array.isArray(customer.sales) ? customer.sales as Row[] : [];
  return <section className="keeper-detail">
    <button type="button" className="keeper-back" onClick={onBack}>← กลับไปรายชื่อลูกค้า</button>
    <header className="keeper-detail-identity">
      <div><small>THE TRUSTED KEEPER</small><h2>{displayValue(customer.displayName)}</h2><p>บุคคลที่มีความสัมพันธ์ซึ่งบันทึกไว้กับฟาร์ม</p></div>
      <StatusBadge status={customer.status}/>
      <ContactLedger customer={customer}/>
      <div className="keeper-relationship-summary"><span><small>การจอง</small><strong>{reservations.length}</strong></span><span><small>การขาย</small><strong>{sales.length}</strong></span></div>
    </header>
    <section className="keeper-relationships" aria-label="ความสัมพันธ์ที่บันทึกไว้">
      <header><small>TRUSTED RELATIONSHIPS</small><h3>ความสัมพันธ์กับฟาร์ม</h3><p>รายการอ้างอิงจาก Customer Detail โดยแยกการจองและการขายตาม canonical object</p></header>
      <div className="keeper-relationship-columns">
        <section className="keeper-reference-group"><header><small>RESERVATION REFERENCES</small><h4>การจอง</h4><b>{reservations.length}</b></header>{reservations.length ? reservations.map((reservation, index) => <article className="keeper-reference-row" key={String(reservation.reservationId)}><span className="keeper-reference-sequence">{String(index + 1).padStart(2, "0")}</span><BirdReference bird={birdOf(reservation.birdId)}/><span className="keeper-reference-state"><StatusBadge status={reservation.status}/><small>จอง {isoToThaiDisplay(reservation.reservedOn) || "-"}</small></span></article>) : <EmptyState title="ยังไม่มีข้อมูลการจอง"/>}</section>
        <section className="keeper-reference-group"><header><small>SALE REFERENCES</small><h4>การขาย</h4><b>{sales.length}</b></header>{sales.length ? sales.map((sale, index) => <article className="keeper-reference-row" key={String(sale.saleId)}><span className="keeper-reference-sequence">{String(index + 1).padStart(2, "0")}</span><BirdReference bird={birdOf(sale.birdId)}/><span className="keeper-reference-state"><StatusBadge status={sale.status}/><small>สร้าง {isoToThaiDisplay(sale.createdOn) || "-"}</small>{sale.completedOn && <small>ปิด {isoToThaiDisplay(sale.completedOn)}</small>}</span></article>) : <EmptyState title="ยังไม่มีข้อมูลการขาย"/>}</section>
      </div>
    </section>
  </section>;
}

export function Customers({ customers, birds, createForm }: { customers: Row[]; birds: Row[]; createForm: ReactNode }) {
  const [query, setQuery] = useState("");
  const [detail, setDetail] = useState<Row | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const normalized = query.trim().toLocaleLowerCase();
  const visible = useMemo(() => customers.filter(customer => !normalized || [customer.displayName, customer.phone, customer.email].some(value => String(value ?? "").toLocaleLowerCase().includes(normalized))), [customers, normalized]);
  const open = async (customer: Row) => { setLoading(true); setError(""); try { setDetail(await invoke("getCustomerDetails", { customerId: customer.customerId }) as Row); } catch (caught) { setError(thaiError(caught)); } finally { setLoading(false); } };
  if (detail) return <CustomerDetail customer={detail} birds={birds} onBack={() => setDetail(null)}/>;
  return <div className="keeper-workspace">
    <section className="keeper-registry" aria-labelledby="keeper-registry-title">
      <header className="keeper-registry-heading"><div><small>THE RELATIONSHIP LEDGER</small><h2 id="keeper-registry-title">ผู้ดูแลความสัมพันธ์กับฟาร์ม</h2><p>ค้นหาและเปิดข้อมูลบุคคลจากช่องทางติดต่อที่บันทึกไว้อย่างเป็นทางการ</p></div><div><strong>{visible.length}</strong><small>TRUSTED KEEPERS</small></div></header>
      <label className="keeper-search"><span>ค้นหาคนที่เคยติดต่อกับฟาร์ม</span><input aria-label="ค้นหารายชื่อลูกค้า" placeholder="ชื่อ โทรศัพท์ หรืออีเมล" value={query} onChange={event => setQuery(event.target.value)}/><small>ค้นหาจากชื่อ โทรศัพท์ และอีเมลที่อยู่ในทะเบียน</small></label>
      {loading && <p className="muted">กำลังโหลดข้อมูล…</p>}{error && <p role="alert">{error}</p>}
      {visible.length ? <div className="keeper-list">{visible.map((customer, index) => <button type="button" className="keeper-registry-row" key={String(customer.customerId)} aria-label={`Display Name: ${displayValue(customer.displayName)} · Phone: ${displayValue(customer.phone)} · Email: ${displayValue(customer.email)} · Status: ${displayValue(customer.status)}`} onClick={() => void open(customer)}><span className="keeper-sequence">{String(index + 1).padStart(2, "0")}</span><span className="keeper-identity"><small>CUSTOMER</small><strong>{displayValue(customer.displayName)}</strong></span><span className="keeper-contact"><small>โทรศัพท์</small><strong>{displayValue(customer.phone)}</strong></span><span className="keeper-contact"><small>อีเมล</small><strong>{displayValue(customer.email)}</strong></span><StatusBadge status={customer.status}/><span className="keeper-open">ดู <b>→</b></span></button>)}</div> : <EmptyState title={normalized ? "ไม่พบคนที่ตรงกับการค้นหา" : "ยังไม่มีข้อมูลลูกค้า"}/>}
    </section>
    <section className="keeper-record-activity"><header><small>RECORD ACTIVITY</small><h2>เพิ่มบุคคลในทะเบียน</h2><p>บันทึกข้อมูลผู้ติดต่อใหม่โดยใช้ workflow เดิม</p></header>{createForm}</section>
  </div>;
}
