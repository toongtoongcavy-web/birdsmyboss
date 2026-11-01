import { FormEvent, ReactNode, useEffect, useId, useRef, useState } from "react";
import { DateInput } from "./DateInput";
import { isoToThaiDisplay } from "./date";
import { invoke, thaiError } from "./functions";
import { displayCustomerStatus, displayReservationStatus, displaySaleTimelineEvent, displayValue } from "./presentation";
import { OrangeRing } from "./bmb-design-system";
import { EmptyState, StatusBadge, birdVisualClass } from "./ui";
import "./Sales.css";
import "./SalesResponsive.css";
import "./SalesFinal.css";
import "./SalesWorkspace.css";

type Row=Record<string,any>;
type Refresh=()=>Promise<void>|void;
const show=displayValue;
const identity=(bird:Row)=>`${show(bird.displayName)} · Ring ID: ${show(bird.ringId)} · ${show(bird.mutation)} · ${show(bird.currentSex)} · ${show(bird.status)} · ${show(bird.origin)}`;
const customerIdentity=(customer:Row)=>`${show(customer.displayName)} · ${show(customer.phone)} · ${show(customer.email)} · ${displayCustomerStatus(customer.status)}`;

function ActionPanel({label,children}:{label:string;children:ReactNode}) {
  const [open,setOpen]=useState(false), [visited,setVisited]=useState(false), id=useId();
  return <section className="sales-action-panel"><button type="button" className="sales-disclosure" aria-expanded={open} aria-controls={id} onClick={()=>{setOpen(!open);setVisited(true);}}>{label}<span aria-hidden="true">{open?"−":"+"}</span></button><div id={id} hidden={!open}>{visited&&children}</div></section>;
}

function BirdIdentity({bird,compact=false}:{bird:Row;compact?:boolean}){return <span className={`sales-bird-identity${compact?" sales-bird-identity--compact":""} ${birdVisualClass(bird.status)}`}><OrangeRing variant="compact"/><span><small>นก</small><strong>{show(bird.displayName)}</strong><em>Ring ID: {show(bird.ringId)}</em></span></span>}
function CustomerIdentity({customer}:{customer:Row}){return <span className="sales-customer-identity"><small>ลูกค้า</small><strong>{show(customer.displayName)}</strong><span>{show(customer.phone)}</span><span>{show(customer.email)}</span></span>}
function PriceSnapshot({record}:{record:Row}){return typeof record.agreedPrice==="number"&&record.currency==="THB"?<p className="sales-truth-note"><strong>ราคาที่ตกลง:</strong> {show(record.agreedPrice)} THB <small>ราคาตามข้อตกลงเดิม ไม่เปลี่ยนตามประวัติราคา</small></p>:<p className="sales-truth-note">ยังไม่มีการบันทึกราคาที่ตกลง</p>}
function SaleTimeline({saleId}:{saleId:string}){const [events,setEvents]=useState<Row[]>([]);const [error,setError]=useState("");useEffect(()=>{void Promise.resolve(invoke("listSaleTimeline",{saleId})).then(value=>setEvents(Array.isArray(value)?value:[])).catch(caught=>setError(thaiError(caught)));},[saleId]);return <section className="sale-related" aria-label="ประวัติการขาย"><h4>ประวัติการขาย</h4>{error?<p role="alert">{error}</p>:events.length?events.map(event=><p key={String(event.saleTimelineId)}><span>{isoToThaiDisplay(event.occurredAt)||show(event.occurredAt)}</span><strong>{displaySaleTimelineEvent(event.eventType)}</strong></p>):<p className="sales-truth-note">ยังไม่มีเหตุการณ์การขายที่บันทึกไว้</p>}</section>}

function Selector({kind,rows,selected,onSelect,excluded=[]}:{kind:"bird"|"customer";rows:Row[];selected:Row|null;onSelect:(row:Row|null)=>void;excluded?:string[]}){
  const [query,setQuery]=useState(""); const idKey=kind==="bird"?"birdId":"customerId",normalized=query.trim().toLocaleLowerCase();
  const matches=rows.filter(row=>!excluded.includes(String(row[idKey]))).filter(row=>kind!=="bird"||!["sold","given_away","deceased","lost"].includes(String(row.status))).filter(row=>{const fields=kind==="bird"?[row.ringId,row.displayName]:[row.displayName,row.phone,row.email];return !normalized||fields.some(value=>String(value??"").toLocaleLowerCase().includes(normalized));}).slice(0,10);
  const title=kind==="bird"?"นก":"ลูกค้า";
  if(selected)return <section className="card"><strong>{title}</strong><p>{kind==="bird"?identity(selected):customerIdentity(selected)}</p><button type="button" onClick={()=>onSelect(null)}>เปลี่ยน</button></section>;
  return <section className="card"><label className="field">ค้นหา{title} *<input aria-label={`ค้นหา${title}`} value={query} onChange={event=>setQuery(event.target.value)} /></label><div className="list" role="listbox" aria-label={`ผลการค้นหา${title}`}>{matches.map(row=><button type="button" className="row" role="option" aria-selected="false" key={row[idKey]} onClick={()=>{onSelect(row);setQuery("");}}>{kind==="bird"?identity(row):customerIdentity(row)}</button>)}</div></section>;
}

function PaymentForm({ownerType,owner,context,onSaved,maxAmount}:{ownerType:"reservation"|"sale";owner:Row;context:string;onSaved:Refresh;maxAmount?:number}){
  const [amount,setAmount]=useState("");const [currency,setCurrency]=useState("THB");const [method,setMethod]=useState("");const [date,setDate]=useState("");const [message,setMessage]=useState("");const [busy,setBusy]=useState(false);
  const submit=async(event:FormEvent)=>{event.preventDefault();const numeric=Number(amount),receivedOn=date;if(!Number.isFinite(numeric)||numeric<=0||!receivedOn||!currency.trim()||!method.trim()){setMessage("กรุณากรอกข้อมูลการชำระเงินให้ถูกต้อง");return;}if(maxAmount!==undefined&&numeric>maxAmount){setMessage(`จำนวนเงินต้องไม่เกินยอดคงเหลือ ${maxAmount} THB`);return;}setBusy(true);try{await invoke("recordPayment",{[ownerType==="reservation"?"reservationId":"saleId"]:owner[ownerType==="reservation"?"reservationId":"saleId"],amount:numeric,currency:currency.trim(),paymentMethod:method.trim(),receivedOn});setMessage("บันทึกการชำระเงินสำเร็จ");setAmount("");setMethod("");setDate("");await onSaved();}catch(error){setMessage(thaiError(error));}finally{setBusy(false);}};
  return <form className="card" onSubmit={submit}><h5>รับชำระเงิน</h5><p>{context}</p><label className="field">จำนวนเงิน *<input required type="number" step="any" max={maxAmount} aria-label="จำนวนเงิน" value={amount} onChange={e=>setAmount(e.target.value)}/></label><label className="field">สกุลเงิน *<input required aria-label="สกุลเงิน" value={currency} onChange={e=>setCurrency(e.target.value)}/></label><label className="field">วิธีชำระเงิน *<select required aria-label="วิธีชำระเงิน" value={method} onChange={e=>setMethod(e.target.value)}><option value="" disabled>เลือก</option>{["cash","transfer","card","other"].map(value=><option key={value} value={value}>{show(value)}</option>)}</select></label><DateInput label="วันที่รับเงิน" required value={date} onChange={value=>setDate(value??"")}/><button disabled={busy}>{busy?"กำลังบันทึก…":"บันทึกการชำระเงิน"}</button>{message&&<p role="status">{message}</p>}</form>;
}

function RefundForm({payment,refunds,onSaved}:{payment:Row;refunds:Row[];onSaved:Refresh}){
  const [outcome,setOutcome]=useState("");const [amount,setAmount]=useState("");const [reason,setReason]=useState("");const [date,setDate]=useState("");const [message,setMessage]=useState("");const [busy,setBusy]=useState(false);const refunded=refunds.reduce((sum,row)=>sum+Number(row.amount||0),0),remaining=Number(payment.amount)-refunded;
  const submit=async(event:FormEvent)=>{event.preventDefault();const refundedOn=date,numeric=Number(amount);if(!["full_refund","partial_refund","no_refund"].includes(outcome)||!reason.trim()||!refundedOn||(outcome==="partial_refund"&&(!Number.isFinite(numeric)||numeric<=0||numeric>=remaining))){setMessage("กรุณากรอกข้อมูลการคืนเงินให้ถูกต้อง");return;}setBusy(true);try{await invoke("refundPayment",{paymentId:payment.paymentId,outcome,...(outcome==="partial_refund"?{amount:numeric}:{}),reason:reason.trim(),refundedOn});setMessage("บันทึกการคืนเงินสำเร็จ");setOutcome("");setAmount("");setReason("");setDate("");await onSaved();}catch(error){setMessage(thaiError(error));}finally{setBusy(false);}};
  return <form className="card" onSubmit={submit}><h6>คืนเงิน</h6><p>ยอดรับ: {show(payment.amount)} {show(payment.currency)} · คืนแล้ว: {refunded} · คงเหลือ: {remaining}</p><label className="field">รูปแบบ *<select required aria-label="รูปแบบคืนเงิน" value={outcome} onChange={e=>setOutcome(e.target.value)}><option value="" disabled>เลือก</option>{["full_refund","partial_refund","no_refund"].map(value=><option key={value} value={value}>{show(value)}</option>)}</select></label>{outcome==="partial_refund"&&<label className="field">จำนวนเงินคืน *<input required type="number" step="any" aria-label="จำนวนเงินคืน" value={amount} onChange={e=>setAmount(e.target.value)}/></label>}<label className="field">เหตุผล *<input required aria-label="เหตุผลคืนเงิน" value={reason} onChange={e=>setReason(e.target.value)}/></label><DateInput label="วันที่คืนเงิน" required value={date} onChange={value=>setDate(value??"")}/><button disabled={busy}>{busy?"กำลังบันทึก…":"บันทึกการคืนเงิน"}</button>{message&&<p role="status">{message}</p>}</form>;
}

function CancelReservationForm({reservation,payments,refunds,onSaved}:{reservation:Row;payments:Row[];refunds:Row[];onSaved:Refresh}){
  const rows=payments.filter(row=>row.reservationId===reservation.reservationId&&row.status==="received");
  const received=rows.reduce((sum,row)=>sum+Number(row.amount||0),0),refunded=refunds.filter(row=>rows.some(payment=>payment.paymentId===row.paymentId)).reduce((sum,row)=>sum+Number(row.amount||0),0),retained=received-refunded;
  const [serverRequiresDisposition,setServerRequiresDisposition]=useState(false);
  const needsDisposition=retained>0||serverRequiresDisposition;
  const [outcome,setOutcome]=useState(""),[amount,setAmount]=useState(""),[reason,setReason]=useState(""),[date,setDate]=useState(""),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
  const submit=async(event:FormEvent)=>{
    event.preventDefault();
    const numeric=Number(amount);
    if(needsDisposition&&(!["full_refund","partial_refund","no_refund"].includes(outcome)||!reason.trim()||!date||(outcome==="partial_refund"&&(!Number.isFinite(numeric)||numeric<=0||(retained>0&&numeric>=retained))))){setMessage("กรุณาระบุการจัดการเงิน เหตุผล และวันที่ให้ครบถ้วน");return;}
    setBusy(true);setMessage("");
    try{await invoke("cancelReservation",{reservationId:reservation.reservationId,...(needsDisposition?{disposition:{outcome,reason:reason.trim(),refundedOn:date,...(outcome==="partial_refund"?{amount:numeric}:{})}}:{})});await onSaved();}
    catch(error){
      if(String((error as {message?:unknown})?.message??"").includes("Retained reservation money requires an explicit cancellation disposition"))setServerRequiresDisposition(true);
      setMessage(thaiError(error));
    }finally{setBusy(false);}
  };
  return <form className="card" onSubmit={submit}><h5>{needsDisposition?"จัดการเงินก่อนยกเลิกการจอง":"ยืนยันยกเลิกการจอง"}</h5><PriceSnapshot record={reservation}/>
    {serverRequiresDisposition?<p>ยอดเงินล่าสุดไม่ตรงกับข้อมูลที่แสดง กรุณาตรวจสอบยอดรับและคืนเงินก่อนยืนยัน</p>:<p>รับเงินทั้งหมด: {received} THB · คืนแล้ว: {refunded} THB · ยอดที่ต้องจัดการ: {retained} THB</p>}
    {needsDisposition?<><label className="field">การจัดการเงิน *<select required aria-label="การจัดการเงิน" value={outcome} onChange={e=>setOutcome(e.target.value)}><option value="" disabled>เลือก</option><option value="full_refund">คืนเต็มจำนวน</option><option value="partial_refund">คืนบางส่วน</option><option value="no_refund">ไม่คืนเงิน</option></select></label>
      {outcome==="partial_refund"&&<label className="field">จำนวนเงินคืน *<input required type="number" step="any" aria-label="จำนวนเงินคืนเมื่อยกเลิก" value={amount} onChange={e=>setAmount(e.target.value)}/></label>}
      <label className="field">เหตุผล *<input required aria-label="เหตุผลยกเลิกการจอง" value={reason} onChange={e=>setReason(e.target.value)}/></label><DateInput label="วันที่มีผล / คืนเงิน" required value={date} onChange={value=>setDate(value??"")}/><p>บันทึกผลการจัดการเงินพร้อมยกเลิกการจอง กรุณาตรวจสอบก่อนยืนยัน</p></>:<p>ไม่มีเงินคงค้าง ยืนยันยกเลิกการจองนี้หรือไม่</p>}
    <button disabled={busy}>{busy?"กำลังบันทึก…":"ยืนยันยกเลิกการจอง"}</button>{message&&<p role="status">{message}</p>}
  </form>;
}

function CancelSaleForm({sale,onSaved}:{sale:Row;onSaved:Refresh}){
  const [summary,setSummary]=useState<Row|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
  const [outcome,setOutcome]=useState(""),[amount,setAmount]=useState(""),[reason,setReason]=useState(""),[date,setDate]=useState("");
  const load=async()=>{setLoading(true);try{
    const result=await invoke("listSales",{saleId:sale.saleId,cancellationSummary:true}) as Row[];
    const row=Array.isArray(result)?result.find(row=>row.saleId===sale.saleId):undefined;
    if(!row?.cancellationSummary||!["grossReceived","refundTotal","netRetained"].every(key=>Number.isFinite(row.cancellationSummary[key])))throw new Error("summary");
    setSummary(row);
  }catch{setSummary(null);setMessage("โหลดข้อมูลเงินล่าสุดไม่สำเร็จ กรุณาลองอีกครั้ง");}finally{setLoading(false);}};
  useEffect(()=>{void load();},[sale.saleId]);
  const money=summary?.cancellationSummary,paid=Boolean(money&&money.netRetained>0);
  const submit=async(event:FormEvent)=>{event.preventDefault();if(!money||loading||busy)return;
    const numeric=Number(amount);
    if(paid&&(!["full_refund","partial_refund","no_refund"].includes(outcome)||!reason.trim()||!date||(outcome==="partial_refund"&&(!Number.isFinite(numeric)||numeric<=0||numeric>=money.netRetained)))){setMessage("กรุณาระบุวิธีจัดการเงิน เหตุผล วันที่ และจำนวนเงินคืนให้ถูกต้อง");return;}
    setBusy(true);setMessage("");
    try{await invoke("cancelSale",{saleId:sale.saleId,expectedNetRetained:money.netRetained,...(paid?{disposition:{outcome,reason:reason.trim(),refundedOn:date,...(outcome==="partial_refund"?{amount:numeric}:{})}}:{})});await onSaved();}
    catch(error){setMessage(thaiError(error));await load();}finally{setBusy(false);}
  };
  return <form className="card" onSubmit={submit}><h5>{paid?"จัดการเงินก่อนยกเลิกการขาย":"ยืนยันยกเลิกการขาย"}</h5>
    {loading?<p role="status">กำลังตรวจสอบยอดเงินล่าสุด…</p>:summary&&money?<><PriceSnapshot record={summary}/><p>รับเงินทั้งหมด: {money.grossReceived} THB · คืนแล้ว: {money.refundTotal} THB · ยอดที่ต้องจัดการ: {money.netRetained} THB</p>
    {paid?<><label className="field">การจัดการเงิน *<select required aria-label="การจัดการเงินก่อนยกเลิกการขาย" value={outcome} onChange={e=>setOutcome(e.target.value)}><option value="" disabled>เลือก</option><option value="full_refund">คืนเต็มจำนวน</option><option value="partial_refund">คืนบางส่วน</option><option value="no_refund">ไม่คืนเงิน</option></select></label>
    {outcome==="partial_refund"&&<label className="field">จำนวนเงินคืน *<input required type="number" step="any" aria-label="จำนวนเงินคืนเมื่อยกเลิกการขาย" value={amount} onChange={e=>setAmount(e.target.value)}/></label>}
    <label className="field">เหตุผล *<input required aria-label="เหตุผลยกเลิกการขาย" value={reason} onChange={e=>setReason(e.target.value)}/></label><DateInput label="วันที่มีผล / คืนเงิน" required value={date} onChange={value=>setDate(value??"")}/><p>บันทึกการจัดการเงินและยกเลิกการขายพร้อมกัน กรุณาตรวจสอบก่อนยืนยัน</p></>:<p>ไม่มีเงินคงค้าง ยืนยันยกเลิกการขายนี้หรือไม่</p>}</>:null}
    <button disabled={loading||busy||!summary||!["draft","confirmed"].includes(String(summary?.status))}>{busy?"กำลังบันทึก…":"ยืนยันยกเลิกการขาย"}</button>
    {!loading&&!summary&&<button type="button" onClick={()=>void load()}>โหลดข้อมูลเงินอีกครั้ง</button>}{message&&<p role="status">{message}</p>}
  </form>;
}

const inCancellationScope=(owner:Row,payment:Row)=>owner.status!=="cancelled"||!Array.isArray(owner.cancellationPaymentIds)||owner.cancellationPaymentIds.includes(payment.paymentId);

function Payments({ownerType,owner,payments,refunds,onSaved,context,blocked=false}:{ownerType:"reservation"|"sale";owner:Row;payments:Row[];refunds:Row[];onSaved:Refresh;context:string;blocked?:boolean}){
  const ownerId=owner[ownerType==="reservation"?"reservationId":"saleId"],rows=payments.filter(payment=>payment[ownerType==="reservation"?"reservationId":"saleId"]===ownerId||(ownerType==="sale"&&owner.reservationId&&payment.reservationId===owner.reservationId)).filter(payment=>ownerType!=="sale"||inCancellationScope(owner,payment));const panelId=useId();const [action,setAction]=useState<"payment"|"refund"|null>(null);const [selectedId,setSelectedId]=useState<string|null>(null),selected=rows.find(row=>row.paymentId===selectedId);const received=rows.filter(row=>row.status==="received").reduce((sum,row)=>sum+Number(row.amount||0),0),refunded=refunds.filter(refund=>rows.some(row=>row.paymentId===refund.paymentId)).reduce((sum,row)=>sum+Number(row.amount||0),0),paid=received-refunded,hasAgreement=typeof owner.agreedPrice==="number"&&Number.isFinite(owner.agreedPrice),remaining=hasAgreement?Math.max(0,owner.agreedPrice-paid):undefined;
  return <section className="commercial-ledger">
    <header><span><small>การชำระเงิน</small><h5>รายการชำระเงิน</h5></span><strong>{rows.length}</strong></header>
    {ownerType==="sale"&&owner.status==="cancelled"?<p className="sales-truth-note">รับเงินทั้งหมด: {received} THB · คืนแล้ว: {refunded} THB · ยอดที่คงไว้: {paid} THB</p>:hasAgreement&&<p className="sales-truth-note"><strong>ราคาที่ตกลง:</strong> {show(owner.agreedPrice)} {show(owner.currency)} · <strong>รับชำระสุทธิ:</strong> {show(paid)} {show(owner.currency)} · <strong>คงเหลือ:</strong> {show(remaining)} {show(owner.currency)}</p>}
    {rows.length?<div className="commercial-ledger-rows">{rows.map((payment,index)=><button type="button" className="commercial-ledger-row" aria-pressed={selectedId===String(payment.paymentId)} key={payment.paymentId} onClick={()=>{setSelectedId(String(payment.paymentId));setAction(null);}}><span className="ledger-sequence">{String(index+1).padStart(2,"0")}</span><strong>{show(payment.amount)} {show(payment.currency)}</strong><span>{isoToThaiDisplay(payment.receivedOn)||"-"}</span><span>{show(payment.paymentMethod)}</span><StatusBadge status={payment.status}/></button>)}</div>:<p className="commercial-ledger-empty">ยังไม่มีรายการชำระเงินที่บันทึกไว้</p>}
    {refunds.filter(refund=>rows.some(row=>row.paymentId===refund.paymentId)).length>0&&<section className="sale-related" aria-label="ประวัติการคืนเงิน"><h4>ประวัติการคืนเงิน</h4>{refunds.filter(refund=>rows.some(row=>row.paymentId===refund.paymentId)).map(refund=><p key={refund.refundId}><span>{isoToThaiDisplay(refund.refundedOn)||"-"} · {show(refund.outcome)}</span>{refund.outcome==="no_refund"?<span>{refund.reason?`เหตุผล: ${refund.reason}`:"บันทึกการตัดสินใจไม่คืนเงิน"}</span>:<strong>{show(refund.amount)} {show(rows.find(row=>row.paymentId===refund.paymentId)?.currency)}</strong>}</p>)}</section>}
    {ownerType==="sale"&&owner.status==="cancelled"?<p>รายการขายนี้ยกเลิกแล้ว แสดงประวัติการเงินเพื่อการตรวจสอบ</p>:<><div className="sales-payment-actions">
      {blocked?<p className="sales-truth-note">สร้างการขายแล้ว กรุณารับชำระเงินต่อในรายการขาย</p>:remaining!==undefined&&remaining<=0?<p className="sales-truth-note"><strong>ชำระครบแล้ว</strong></p>:<button type="button" aria-expanded={action==="payment"} aria-controls={`${panelId}-payment`} onClick={()=>setAction(action==="payment"?null:"payment")}>รับชำระเงิน</button>}
      {selected&&<button type="button" aria-expanded={action==="refund"} aria-controls={`${panelId}-refund`} onClick={()=>setAction(action==="refund"?null:"refund")}>คืนเงิน</button>}
    </div>
    {!blocked&&(remaining===undefined||remaining>0)&&<div id={`${panelId}-payment`} hidden={action!=="payment"}><PaymentForm ownerType={ownerType} owner={owner} context={context} onSaved={onSaved} maxAmount={remaining}/></div>}
    {selected&&<section id={`${panelId}-refund`} hidden={action!=="refund"} className="commercial-refund-activity" key={selected.paymentId}><RefundForm payment={selected} refunds={refunds.filter(refund=>refund.paymentId===selected.paymentId)} onSaved={onSaved}/></section>}</>}
  </section>;
}

function SaleCreateForm({birds,customers,reservation,onSaved,excludedBirdIds=[]}:{birds:Row[];customers:Row[];reservation?:Row;onSaved:Refresh;excludedBirdIds?:string[]}){
  const fixedBird=reservation?birds.find(row=>row.birdId===reservation.birdId)??null:null,fixedCustomer=reservation?customers.find(row=>row.customerId===reservation.customerId)??null:null;const [bird,setBird]=useState<Row|null>(null),[customer,setCustomer]=useState<Row|null>(null),[date,setDate]=useState(""),[agreedPrice,setAgreedPrice]=useState(""),[message,setMessage]=useState(""),[busy,setBusy]=useState(false);const selectedBird=fixedBird??bird,selectedCustomer=fixedCustomer??customer;const reservationHasPrice=typeof reservation?.agreedPrice==="number"&&Number.isFinite(reservation.agreedPrice)&&reservation.agreedPrice>0&&reservation.currency==="THB";
  const submit=async(event:FormEvent)=>{event.preventDefault();const createdOn=date,numeric=Number(agreedPrice),reservationNeedsPrice=Boolean(reservation&&!reservationHasPrice);if(!selectedBird||!selectedCustomer||!createdOn){setMessage("กรุณาเลือกนก ลูกค้า และวันที่ให้ครบ");return;}if((reservationNeedsPrice||(!reservation&&agreedPrice.trim()!==""))&&(!agreedPrice.trim()||!Number.isFinite(numeric)||numeric<=0)){setMessage("ราคาที่ตกลงต้องมากกว่าศูนย์");return;}setBusy(true);try{await invoke("createSale",{birdId:selectedBird.birdId,customerId:selectedCustomer.customerId,...(reservation?{reservationId:reservation.reservationId,...(reservationNeedsPrice?{agreedPrice:numeric,currency:"THB"}:{})}:agreedPrice.trim()?{agreedPrice:numeric,currency:"THB"}:{}),createdOn});setMessage("สร้างการขายสำเร็จ");if(!reservation){setBird(null);setCustomer(null);setAgreedPrice("");}setDate("");await onSaved();}catch(error){setMessage(thaiError(error));}finally{setBusy(false);}};
  return <form className="card" onSubmit={submit}><h5>{reservation?"สร้างการขายจากการจอง":"สร้างการขายโดยตรง"}</h5>{reservation?<><p>นก: {selectedBird?identity(selectedBird):"-"}</p><p>ลูกค้า: {selectedCustomer?customerIdentity(selectedCustomer):"-"}</p>{reservationHasPrice?<PriceSnapshot record={reservation}/>:<label className="field">ราคาที่ตกลง (THB) *<input required type="number" min="0.01" step="any" aria-label="ราคาที่ตกลงสำหรับการขาย" value={agreedPrice} onChange={event=>setAgreedPrice(event.target.value)}/></label>}</>:<><Selector kind="bird" rows={birds} selected={bird} onSelect={setBird} excluded={excludedBirdIds}/><Selector kind="customer" rows={customers} selected={customer} onSelect={setCustomer}/><label className="field">ราคาที่ตกลง (ไม่บังคับ, THB)<input type="number" min="0.01" step="any" aria-label="ราคาที่ตกลงสำหรับการขาย" value={agreedPrice} onChange={event=>setAgreedPrice(event.target.value)}/></label></>}<DateInput label="วันที่สร้างการขาย" required value={date} onChange={value=>setDate(value??"")}/><button disabled={busy}>{busy?"กำลังสร้าง…":"สร้างการขาย"}</button>{message&&<p role="status">{message}</p>}</form>;
}

function CompleteSaleForm({sale,onSaved}:{sale:Row;onSaved:Refresh}){const [date,setDate]=useState(""),[message,setMessage]=useState(""),[busy,setBusy]=useState(false);const submit=async(event:FormEvent)=>{event.preventDefault();const completedOn=date;if(!completedOn){setMessage("กรุณากรอกวันที่ที่มีอยู่จริง");return;}setBusy(true);try{await invoke("completeSale",{saleId:sale.saleId,completedOn});setMessage("ปิดการขายสำเร็จ");setDate("");await onSaved();}catch(error){setMessage(thaiError(error));}finally{setBusy(false);}};if(sale.remainingBalance!==0)return <p className="sales-truth-note">ยังมียอดคงเหลือ ต้องชำระครบก่อนปิดการขาย</p>;return <form className="card" onSubmit={submit}><h5>ปิดการขาย</h5><DateInput label="วันที่ปิดการขาย" required value={date} onChange={value=>setDate(value??"")}/><button disabled={busy}>{busy?"กำลังปิด…":"ปิดการขาย"}</button>{message&&<p role="status">{message}</p>}</form>;}
function LifecycleAction({operation,payload,label,onSaved}:{operation:string;payload:Row;label:string;onSaved:Refresh}){const [message,setMessage]=useState("");const [busy,setBusy]=useState(false);const act=async()=>{setBusy(true);try{await invoke(operation,payload);setMessage("บันทึกสถานะสำเร็จ");await onSaved();}catch(error){setMessage(thaiError(error));}finally{setBusy(false);}};return <section className="card"><h5>{label}</h5><button type="button" disabled={busy} onClick={()=>void act()}>{busy?"กำลังบันทึก…":label}</button>{message&&<p role="status">{message}</p>}</section>}
function ExpireReservationForm({reservation,onSaved}:{reservation:Row;onSaved:Refresh}){const [date,setDate]=useState("");const [message,setMessage]=useState("");const [busy,setBusy]=useState(false);const submit=async(event:FormEvent)=>{event.preventDefault();const expiredOn=date;if(!expiredOn){setMessage("กรุณากรอกวันที่ที่มีอยู่จริง");return;}setBusy(true);try{await invoke("expireReservation",{reservationId:reservation.reservationId,expiredOn});setMessage("บันทึกสถานะหมดอายุสำเร็จ");await onSaved();}catch(error){setMessage(thaiError(error));}finally{setBusy(false);}};return <form className="card" onSubmit={submit}><h5>หมดอายุการจอง</h5><DateInput label="วันที่หมดอายุ" required value={date} onChange={value=>setDate(value??"")}/><button disabled={busy}>{busy?"กำลังบันทึก…":"บันทึกหมดอายุ"}</button>{message&&<p role="status">{message}</p>}</form>}

export function Commercial({birds,customers,reservations,payments,refunds,sales,giveaways,deliveries=[],handovers=[],onRefresh}:{birds:Row[];customers:Row[];reservations:Row[];payments:Row[];refunds:Row[];sales:Row[];giveaways:Row[];deliveries?:Row[];handovers?:Row[];onRefresh:Refresh}){
  const [createMode,setCreateMode]=useState<"reservation"|"sale"|null>(null);
  const [selectedReservationId,setSelectedReservationId]=useState<string|null>(null),[selectedSaleId,setSelectedSaleId]=useState<string|null>(null);const selectedReservation=reservations.find(row=>row.reservationId===selectedReservationId),selectedSaleRecord=sales.find(row=>row.saleId===selectedSaleId);const birdOf=(id:unknown)=>birds.find(row=>row.birdId===id),customerOf=(id:unknown)=>customers.find(row=>row.customerId===id);
  const selectedPayments=selectedSaleRecord?payments.filter(row=>row.saleId===selectedSaleRecord.saleId||(selectedSaleRecord.reservationId&&row.reservationId===selectedSaleRecord.reservationId)).filter(row=>inCancellationScope(selectedSaleRecord,row)):[],selectedReceived=selectedPayments.filter(row=>row.status==="received").reduce((sum,row)=>sum+Number(row.amount||0),0),selectedRefunded=refunds.filter(refund=>selectedPayments.some(payment=>payment.paymentId===refund.paymentId)).reduce((sum,row)=>sum+Number(row.amount||0),0),selectedSale:Row|undefined=selectedSaleRecord?{...selectedSaleRecord,remainingBalance:typeof selectedSaleRecord.agreedPrice==="number"&&Number.isFinite(selectedSaleRecord.agreedPrice)?Math.max(0,selectedSaleRecord.agreedPrice-(selectedReceived-selectedRefunded)):undefined}:undefined;
  const reservationContext=(row:Row)=>`${identity(birdOf(row.birdId)??{})} / ลูกค้า: ${customerIdentity(customerOf(row.customerId)??{})}`;
  const selectedBird=selectedSale?birdOf(selectedSale.birdId)??{}:{},selectedCustomer=selectedSale?customerOf(selectedSale.customerId)??{}:{};
  const activeReservations=reservations.filter(reservation=>reservation.status==="active"&&!sales.some(sale=>sale.reservationId===reservation.reservationId&&sale.status!=="cancelled"));
  const saleCommittedBirdIds=sales.filter(sale=>["draft","confirmed","completed"].includes(String(sale.status))).map(sale=>String(sale.birdId)),activeReservationBirdIds=reservations.filter(reservation=>reservation.status==="active").map(reservation=>String(reservation.birdId)),giveawayCommittedBirdIds=giveaways.filter(giveaway=>["planned","completed"].includes(String(giveaway.status))).map(giveaway=>String(giveaway.birdId)),commerciallyCommittedBirdIds=[...new Set([...activeReservationBirdIds,...saleCommittedBirdIds,...giveawayCommittedBirdIds])];
  const selectedSaleReservation=selectedSale?.reservationId?reservations.find(reservation=>reservation.reservationId===selectedSale.reservationId):undefined;
  const saleDeliveries=selectedSale?deliveries.filter(row=>row.saleId===selectedSale.saleId):[],saleHandovers=selectedSale?handovers.filter(row=>row.saleId===selectedSale.saleId):[];
  const selectedReservationHasSale=Boolean(selectedReservation&&sales.some(sale=>sale.reservationId===selectedReservation.reservationId&&sale.status!=="cancelled"));
  const detailRef=useRef<HTMLElement>(null);
  useEffect(()=>{
    if(selectedSaleId||selectedReservationId){
      detailRef.current?.focus({preventScroll:true});
      detailRef.current?.scrollIntoView?.({block:"start",behavior:"auto"});
    }
  },[selectedSaleId,selectedReservationId]);
  const isRegistry=!selectedSale&&!selectedReservation;
  return <div className="sales-workspace">
    <header className="sales-page-header"><small>BIRDS MY BOSS</small><h1>การขาย</h1><p>จัดการการจอง การขาย การชำระเงิน และสถานะการส่งมอบ</p></header>
    {isRegistry&&<>
      <section className="sales-summary" aria-label="สรุปการขาย">
        <div><span>การจองที่ใช้งานอยู่</span><strong>{activeReservations.length}</strong></div>
        <div><span>การขายที่กำลังดำเนินการ</span><strong>{sales.filter(row=>["draft","confirmed"].includes(row.status)).length}</strong></div>
        <div><span>การขายที่เสร็จสิ้น</span><strong>{sales.filter(row=>row.status==="completed").length}</strong></div>
      </section>
      <section className="sales-create-zone" aria-label="สร้างรายการ">
        <div className="sales-create-modes" role="group" aria-label="เลือกสร้างรายการ">
          <button type="button" aria-expanded={createMode==="reservation"} aria-controls="create-reservation" onClick={()=>setCreateMode(createMode==="reservation"?null:"reservation")}>สร้างการจอง</button>
          <button type="button" aria-expanded={createMode==="sale"} aria-controls="create-sale" onClick={()=>setCreateMode(createMode==="sale"?null:"sale")}>ขายโดยตรง</button>
        </div>
        <div id="create-reservation" hidden={createMode!=="reservation"}><ReservationCreate birds={birds} customers={customers} excludedBirdIds={commerciallyCommittedBirdIds} onSaved={onRefresh}/></div>
        <div id="create-sale" hidden={createMode!=="sale"}><SaleCreateForm birds={birds} customers={customers} excludedBirdIds={commerciallyCommittedBirdIds} onSaved={onRefresh}/></div>
      </section>
      <section className="sales-registry" aria-labelledby="sales-registry-title">
        <header className="sales-section-heading"><h2 id="sales-registry-title">รายการขาย</h2><span>{sales.length} รายการ</span></header>
        {sales.length?<div className="sales-list">{sales.map(row=>{const bird=birdOf(row.birdId)??{},customer=customerOf(row.customerId)??{},paymentCount=payments.filter(payment=>payment.saleId===row.saleId||(row.reservationId&&payment.reservationId===row.reservationId)).length;return <button type="button" className="sale-registry-row" key={row.saleId} aria-label={`${show(customer.displayName)} · ${show(bird.displayName)} · Ring ID: ${show(bird.ringId)} · ${show(row.status)} · ${isoToThaiDisplay(row.createdOn)||"-"}`} onClick={()=>{setSelectedSaleId(String(row.saleId));setCreateMode(null);}}>
          <BirdIdentity bird={bird} compact/><CustomerIdentity customer={customer}/>
          <span className="sale-registry-state"><StatusBadge status={row.status}/><small>{isoToThaiDisplay(row.createdOn)||"-"}</small>{paymentCount>0&&<em>การชำระเงิน {paymentCount} รายการ</em>}</span>
          <span className="sale-registry-price">{typeof row.agreedPrice==="number"&&row.currency==="THB"?<><small>ราคาที่ตกลง</small><strong>{show(row.agreedPrice)} THB</strong></>:<small>ยังไม่ระบุราคา</small>}</span>
          <span className="sale-registry-open" aria-hidden="true">→</span>
        </button>})}</div>:<EmptyState title="ยังไม่มีข้อมูลการขาย"/>}
      </section>
      <section className="reservation-registry"><header className="sales-section-heading"><h2>การจอง</h2><span>{activeReservations.length} รายการ</span></header>{activeReservations.length?activeReservations.map(row=><button type="button" className="reservation-row" key={row.reservationId} onClick={()=>{setSelectedReservationId(String(row.reservationId));setCreateMode(null);}}><BirdIdentity bird={birdOf(row.birdId)??{}} compact/><CustomerIdentity customer={customerOf(row.customerId)??{}}/><span className="reservation-state"><StatusBadge status={row.status} label={displayReservationStatus(row.status)}/><small>จอง {isoToThaiDisplay(row.reservedOn)||"-"}</small>{payments.some(payment=>payment.reservationId===row.reservationId)&&<small>การชำระเงิน {payments.filter(payment=>payment.reservationId===row.reservationId).length} รายการ</small>}{row.expiresOn&&<small>หมดอายุ {isoToThaiDisplay(row.expiresOn)}</small>}</span><span className="sale-registry-price">{typeof row.agreedPrice==="number"&&row.currency==="THB"&&<><small>ราคาที่ตกลง</small><strong>{show(row.agreedPrice)} THB</strong></>}</span><span className="sale-registry-open" aria-hidden="true">→</span></button>):<EmptyState title="ไม่มีการจองที่กำลังดำเนินการ"/>}</section>
    </>}
    {selectedSale&&<section className="sale-detail" key={selectedSale.saleId} ref={detailRef} tabIndex={-1} aria-label="รายละเอียดการขาย">
      <button type="button" className="sales-back" onClick={()=>setSelectedSaleId(null)}>← กลับไปรายการขาย</button>
      <header className="sale-detail-hero"><div><small>การขาย</small><h2>รายละเอียดการขาย</h2></div><StatusBadge status={selectedSale.status}/>
        <div className="sale-parties"><BirdIdentity bird={selectedBird}/><CustomerIdentity customer={selectedCustomer}/></div>
        <div className="sale-state-strip"><span><small>วันที่สร้าง</small><strong>{isoToThaiDisplay(selectedSale.createdOn)||"-"}</strong></span>{selectedSale.completedOn&&<span><small>วันที่ปิด</small><strong>{isoToThaiDisplay(selectedSale.completedOn)}</strong></span>}</div>
        <PriceSnapshot record={selectedSale}/>
        {selectedSaleReservation&&<p className="sales-truth-note"><strong>สร้างจากการจองวันที่ {isoToThaiDisplay(selectedSaleReservation.reservedOn)||"-"}</strong>{selectedSaleReservation.expiresOn&&<> · วันหมดอายุเดิม {isoToThaiDisplay(selectedSaleReservation.expiresOn)}</>}</p>}
      </header>
      <div className="sale-detail-grid">
        <Payments key={selectedSale.saleId} ownerType="sale" owner={selectedSale} payments={payments} refunds={refunds} context={`${identity(selectedBird)} / ${customerIdentity(selectedCustomer)}`} onSaved={onRefresh}/>
        {["draft","confirmed"].includes(selectedSale.status)&&<aside className="sale-next-action"><h3>ดำเนินการต่อ</h3>
          {selectedSale.status==="draft"&&<LifecycleAction operation="confirmSale" payload={{saleId:selectedSale.saleId}} label="ยืนยันการขาย" onSaved={onRefresh}/>}
          {selectedSale.status==="confirmed"&&(selectedSale.remainingBalance===0?<ActionPanel label="ปิดการขาย"><CompleteSaleForm sale={selectedSale} onSaved={onRefresh}/></ActionPanel>:<p className="sales-truth-note">ยังมียอดคงเหลือ ต้องชำระครบก่อนปิดการขาย</p>)}
          <ActionPanel label="ยกเลิกการขาย"><CancelSaleForm sale={selectedSale} onSaved={onRefresh}/></ActionPanel>
        </aside>}
        <div className="sale-history"><SaleTimeline key={`${selectedSale.saleId}-${selectedSale.status}`} saleId={String(selectedSale.saleId)}/>
          {saleDeliveries.length>0&&<section className="sale-related"><h4>การจัดส่ง</h4>{saleDeliveries.map(row=><p key={row.deliveryId}><span>{isoToThaiDisplay(row.createdOn)||"-"} · {show(row.distanceKm)} km</span><strong>{show(row.shippingFee)} {show(row.currency)}</strong><StatusBadge status={row.status}/></p>)}</section>}
          {saleHandovers.length>0&&<section className="sale-related"><h4>การส่งมอบ</h4>{saleHandovers.map(row=><p key={row.handoverId}><span>{isoToThaiDisplay(row.handoverOn)||"-"} · {show(row.recipientSnapshot?.name)}</span><StatusBadge status={row.status}/></p>)}</section>}
          {saleDeliveries.length===0&&saleHandovers.length===0&&<p className="sales-truth-note">ยังไม่มีข้อมูลการจัดส่งหรือส่งมอบที่เชื่อมกับการขายนี้</p>}
        </div>
      </div>
    </section>}
    {selectedReservation&&!selectedSale&&<section className="reservation-detail" key={selectedReservation.reservationId} ref={detailRef} tabIndex={-1} aria-label="รายละเอียดการจอง">
      <button type="button" className="sales-back" onClick={()=>setSelectedReservationId(null)}>กลับไปรายการจอง</button>
      <header className="sale-detail-hero"><div><small>การจอง</small><h2>รายละเอียดการจอง</h2></div><StatusBadge status={selectedReservation.status} label={displayReservationStatus(selectedReservation.status)}/><div className="sale-parties"><BirdIdentity bird={birdOf(selectedReservation.birdId)??{}}/><CustomerIdentity customer={customerOf(selectedReservation.customerId)??{}}/></div><div className="sale-state-strip"><span>วันที่จอง: {isoToThaiDisplay(selectedReservation.reservedOn)||"-"}</span><span>วันหมดอายุ: {isoToThaiDisplay(selectedReservation.expiresOn)||"-"}</span><span>สถานะ: {displayReservationStatus(selectedReservation.status)}</span></div><PriceSnapshot record={selectedReservation}/></header>
      <div className="sale-detail-grid">
        <Payments key={selectedReservation.reservationId} ownerType="reservation" owner={selectedReservation} payments={payments} refunds={refunds} context={reservationContext(selectedReservation)} onSaved={onRefresh} blocked={selectedReservationHasSale}/>
        {selectedReservation.status==="active"&&<aside className="sale-next-action"><h3>ดำเนินการต่อ</h3>
          {!selectedReservationHasSale&&<ActionPanel label="สร้างการขายจากการจอง"><SaleCreateForm birds={birds} customers={customers} reservation={selectedReservation} onSaved={onRefresh}/></ActionPanel>}
          {!selectedReservationHasSale&&<ActionPanel label="ยกเลิกการจอง"><CancelReservationForm reservation={selectedReservation} payments={payments} refunds={refunds} onSaved={onRefresh}/></ActionPanel>}
          {selectedReservation.expiresOn&&<ActionPanel label="หมดอายุการจอง"><ExpireReservationForm reservation={selectedReservation} onSaved={onRefresh}/></ActionPanel>}
        </aside>}
      </div>
    </section>}
  </div>;
}

function ReservationCreate({birds,customers,excludedBirdIds,onSaved}:{birds:Row[];customers:Row[];excludedBirdIds:string[];onSaved:Refresh}){const [bird,setBird]=useState<Row|null>(null),[customer,setCustomer]=useState<Row|null>(null),[reservedOn,setReservedOn]=useState(""),[expiresOn,setExpiresOn]=useState(""),[agreedPrice,setAgreedPrice]=useState(""),[message,setMessage]=useState(""),[busy,setBusy]=useState(false);const submit=async(event:FormEvent)=>{event.preventDefault();const reserved=reservedOn,expires=expiresOn?expiresOn:undefined,numeric=Number(agreedPrice);if(!bird||!customer||!reserved||(expiresOn&&!expires)||expires&&expires<reserved){setMessage("กรุณากรอกข้อมูลการจองให้ถูกต้อง");return;}if(agreedPrice.trim()!==""&&(!Number.isFinite(numeric)||numeric<=0)){setMessage("ราคาที่ตกลงต้องมากกว่าศูนย์");return;}setBusy(true);try{await invoke("createReservation",{birdId:bird.birdId,customerId:customer.customerId,reservedOn:reserved,...(expires?{expiresOn:expires}:{}),...(agreedPrice.trim()?{agreedPrice:numeric,currency:"THB"}:{})});setMessage("สร้างการจองสำเร็จ");setBird(null);setCustomer(null);setReservedOn("");setExpiresOn("");setAgreedPrice("");await onSaved();}catch(error){setMessage(thaiError(error));}finally{setBusy(false);}};return <form className="card" onSubmit={submit}><h3>สร้างการจอง</h3><Selector kind="bird" rows={birds} selected={bird} onSelect={setBird} excluded={excludedBirdIds}/><Selector kind="customer" rows={customers} selected={customer} onSelect={setCustomer}/><DateInput label="วันที่จอง" required value={reservedOn} onChange={value=>setReservedOn(value??"")}/><DateInput label="วันหมดอายุ" value={expiresOn} onChange={value=>setExpiresOn(value??"")}/><label className="field">ราคาที่ตกลง (ไม่บังคับ, THB)<input type="number" min="0.01" step="any" aria-label="ราคาที่ตกลงสำหรับการจอง" value={agreedPrice} onChange={event=>setAgreedPrice(event.target.value)}/></label><button disabled={busy}>{busy?"กำลังสร้าง…":"สร้างการจอง"}</button>{message&&<p role="status">{message}</p>}</form>;}
