import { BmbMetric, OperationalSignal, OrangeRing, SummaryGroup } from "./bmb-design-system";
import "./Dashboard.css";

type Row=Record<string,any>;
type DashboardPage="Birds"|"Breeding"|"Sales"|"Customers";

export function Dashboard({data,summary,navigate}:{data:Record<string,Row[]>;summary:Row|null;navigate:(page:DashboardPage)=>void}){
  const birds=data.listBirds??[],pairs=data.listPairs??[],cycles=data.listBreedingCycles??[],reservations=data.listReservations??[],sales=data.listSales??[],deliveries=data.listDeliveries??[];
  const total=summary?.birds??birds.length,active=birds.filter(item=>item.status==="active").length,sold=birds.filter(item=>item.status==="sold").length;
  const activePairs=summary?.activePairs??pairs.filter(item=>item.status==="active").length,activeCycles=cycles.filter(item=>item.status==="active").length;
  const activeReservations=summary?.activeReservations??reservations.filter(item=>item.status==="active").length,pendingDeliveries=summary?.pendingDeliveries??deliveries.filter(item=>item.status==="planned").length;
  const publishedPassports=birds.filter(item=>item.passportStatus==="published").length;
  return <div className="dashboard-signature">
    <header className="dashboard-heading"><div><span className="eyebrow">Birds My Boss</span><h1>ภาพรวมฟาร์ม</h1><p>สถานะสำคัญและงานประจำวันของฟาร์มในมุมมองเดียว</p></div><span className="dashboard-heading-mark" aria-hidden="true"/></header>
    <section className="farm-pulse" aria-labelledby="farm-pulse-title">
      <div className="farm-pulse-intro"><small>FARM PULSE</small><h2 id="farm-pulse-title">ฟาร์มของฉันวันนี้</h2><p>ภาพรวมประชากรนกและสัญญาณการดำเนินงานจากข้อมูลปัจจุบัน</p><BmbMetric label="นกทั้งหมด" value={total} kind="primary" identity/></div>
      <div className="flock-state" aria-label="สถานะประชากรนก"><BmbMetric label="นกที่ใช้งาน" value={active}/><BmbMetric label="นกที่ขายแล้ว" value={sold}/></div>
      <div className="pulse-geometry" aria-hidden="true"><span/><span/></div>
    </section>
    <section className="dashboard-signals" aria-labelledby="signals-title"><header><small>สถานะการดำเนินงาน</small><h2 id="signals-title">สิ่งที่กำลังเกิดขึ้นในฟาร์ม</h2><p>ตัวเลขสรุปจาก workflow ที่มีอยู่ โดยไม่สร้างการแจ้งเตือนเพิ่มเติม</p></header><div className="signal-groups">
      <SummaryGroup eyebrow="Breeding" title="การเพาะพันธุ์"><OperationalSignal label="คู่เพาะที่ใช้งาน" value={activePairs}/><OperationalSignal label="รอบเพาะที่ดำเนินอยู่" value={activeCycles} tone="milestone"/></SummaryGroup>
      <SummaryGroup eyebrow="Business" title="การดำเนินงาน"><OperationalSignal label="การจองที่ใช้งาน" value={activeReservations}/><OperationalSignal label="การขาย" value={sales.length} tone="neutral"/><OperationalSignal label="การจัดส่งที่รอดำเนินการ" value={pendingDeliveries} tone="milestone"/></SummaryGroup>
      <SummaryGroup eyebrow="Trust & identity" title="ความน่าเชื่อถือ"><OperationalSignal label="Passport ที่เผยแพร่" value={publishedPassports} tone="trust"/></SummaryGroup>
    </div></section>
    <section className="dashboard-actions" aria-labelledby="quick-actions-title"><div><small>งานประจำวัน</small><h2 id="quick-actions-title">เริ่มงานอย่างรวดเร็ว</h2><p>ไปยัง workflow ที่มีอยู่แล้วในระบบ</p></div><div className="dashboard-action-list"><button onClick={()=>navigate("Birds")}><OrangeRing variant="inline"/>เพิ่มนก</button><button onClick={()=>navigate("Breeding")}>สร้างคู่</button><button onClick={()=>navigate("Breeding")}>เพิ่มไข่</button><button onClick={()=>navigate("Sales")}>สร้างการจอง</button><button onClick={()=>navigate("Customers")}>เพิ่มลูกค้า</button></div></section>
  </div>;
}
