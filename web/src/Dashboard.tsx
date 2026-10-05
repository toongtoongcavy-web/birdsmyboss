import { useState } from "react";
import "./Dashboard.css";

type Row = Record<string, any>;
type DashboardPage = "Birds" | "Breeding" | "Sales";

const terminalBirdStatuses = new Set(["sold", "given_away", "deceased", "lost"]);

function CalmMetric({ label, value, icon, helper, tone }: { label: string; value: number; icon: string; helper: string; tone: "mint" | "coral" | "gold" | "blue" }) {
  return <article className={`calm-metric calm-metric--${tone}`}><span className="calm-metric-icon" aria-hidden="true">{icon}</span><div><span>{label}</span><small>{helper}</small></div><strong>{value}</strong></article>;
}

export function Dashboard({ data, summary, navigate }: { data: Record<string, Row[]>; summary: Row | null; navigate: (page: DashboardPage) => void }) {
  const [showAll, setShowAll] = useState(false);
  const birds = data.listBirds ?? [];
  const cages = data.listMvpCages ?? data.listCages ?? [];
  const pairs = data.listPairs ?? [];
  const cycles = data.listBreedingCycles ?? [];
  const reservations = data.listReservations ?? [];
  const sales = data.listSales ?? [];
  const deliveries = data.listDeliveries ?? [];
  const currentBirds = birds.filter(bird => !terminalBirdStatuses.has(String(bird.status))).length;
  const activePairs = summary?.activePairs ?? pairs.filter(pair => pair.status === "active").length;
  const emptyCages = cages.filter(cage => cage.status === "active" && Number(cage.occupancyCount ?? 0) === 0).length;
  const activeReservations = summary?.activeReservations ?? reservations.filter(reservation => reservation.status === "active").length;
  const unfinishedSales = sales.filter(sale => ["draft", "confirmed"].includes(String(sale.status))).length;
  const pendingDeliveries = summary?.pendingDeliveries ?? deliveries.filter(delivery => ["planned", "scheduled", "rescheduled", "pickup_at_farm"].includes(String(delivery.status))).length;
  const activeCycles = cycles.filter(cycle => cycle.status === "active").length;
  const today = new Date().toISOString().slice(0, 10);
  const urgentReservations = reservations.filter(item => item.status === "active" && typeof item.expiresOn === "string" && item.expiresOn <= today).length;
  const urgentDeliveries = deliveries.filter(item => ["planned", "scheduled", "rescheduled", "pickup_at_farm"].includes(String(item.status)) && item.scheduledOn === today).length;
  const attention = [
    { level: "urgent", label: "การจองครบกำหนดวันนี้ / เลยกำหนด", value: urgentReservations },
    { level: "urgent", label: "กำหนดส่งมอบวันนี้", value: urgentDeliveries },
    { level: "ongoing", label: "การขายที่ยังไม่เสร็จ", value: unfinishedSales },
    { level: "ongoing", label: "การส่งมอบที่รอดำเนินการ", value: pendingDeliveries },
    { level: "ongoing", label: "รอบเพาะที่ใช้งาน", value: activeCycles },
    { level: "ongoing", label: "การจองที่ใช้งาน", value: activeReservations },
  ].filter(item => item.value > 0);
  const visibleAttention = showAll ? attention : attention.slice(0, 4);
  const followUpTotal = unfinishedSales + pendingDeliveries + activeCycles + activeReservations;
  const urgent = visibleAttention.filter(item => item.level === "urgent");
  const ongoing = visibleAttention.filter(item => item.level === "ongoing");

  return <div className="calm-dashboard">
    <header className="calm-dashboard-header"><div><span className="eyebrow">BIRDS MY BOSS</span><h1>ภาพรวมฟาร์ม</h1><p>วันนี้ฟาร์มเป็นอย่างไรบ้าง</p></div><div className="calm-farm-motif" aria-hidden="true"><span className="calm-bird">●</span><span className="calm-branch">⌁</span><i /><i /></div></header>
    <section className="calm-metrics" aria-label="สรุปฟาร์ม">
      <CalmMetric label="นกในฟาร์ม" value={currentBirds} icon="♩" helper="ประชากรปัจจุบัน" tone="mint" />
      <CalmMetric label="คู่เพาะใช้งาน" value={activePairs} icon="∞" helper="คู่ที่กำลังดำเนินงาน" tone="coral" />
      <CalmMetric label="กรงว่าง" value={emptyCages} icon="⌂" helper="กรงพร้อมใช้งาน" tone="gold" />
      <CalmMetric label="งานที่ต้องติดตาม" value={followUpTotal} icon="✓" helper="รายการที่ยังดำเนินการ" tone="blue" />
    </section>
    <section className="today-card" aria-labelledby="today-title"><header><div><small>วันนี้</small><h2 id="today-title">สิ่งที่ต้องดูวันนี้</h2></div><span aria-hidden="true">○</span></header>
      {attention.length ? <div className="today-list">
        {urgent.length > 0 && <div className="attention-group attention-group--urgent"><h3>ต้องทำวันนี้ / เร่งด่วน</h3>{urgent.map(item => <div className="today-row" key={item.label}><span>{item.label}</span><strong>{item.value}</strong></div>)}</div>}
        {ongoing.length > 0 && <div className="attention-group"><h3>กำลังดำเนินการ</h3>{ongoing.map(item => <div className="today-row" key={item.label}><span>{item.label}</span><strong>{item.value}</strong></div>)}</div>}
        {attention.length > 4 && <button className="show-all-attention" type="button" onClick={() => setShowAll(value => !value)}>{showAll ? "แสดงน้อยลง" : "ดูทั้งหมด"}</button>}
      </div> : <div className="calm-success"><span aria-hidden="true">🌿</span><div><p>วันนี้ทุกอย่างเรียบร้อยดี</p><small>ไม่มีงานเร่งด่วนที่ต้องจัดการ</small></div></div>}
    </section>
    <section className="calm-actions" aria-labelledby="calm-actions-title"><h2 id="calm-actions-title">เริ่มงาน</h2><div><button onClick={() => navigate("Birds")}><span aria-hidden="true">＋</span>เพิ่มนก</button><button onClick={() => navigate("Breeding")}><span aria-hidden="true">∞</span>สร้างคู่</button><button onClick={() => navigate("Breeding")}><span aria-hidden="true">○</span>เพิ่มไข่</button><button onClick={() => navigate("Sales")}><span aria-hidden="true">◇</span>สร้างการจอง</button></div></section>
  </div>;
}
