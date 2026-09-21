import { useEffect, useRef, useState } from "react";
import { App } from "./App";
import { MvpCages } from "./MvpCages";
import "./MvpShell.css";

type Route = "Dashboard" | "Birds" | "Cages" | "Breeding" | "Sales" | "Giveaways" | "Customers" | "Delivery & Handover" | "Passport";

const overview = { route: "Dashboard" as const, label: "ภาพรวม" };
const groups: Array<{ heading: string; items: Array<{ route: Route; label: string }> }> = [
  { heading: "จัดการฟาร์ม", items: [
    { route: "Cages", label: "ข้อมูลกรง" },
    { route: "Birds", label: "ข้อมูลนก" },
    { route: "Breeding", label: "การเพาะพันธุ์" },
    { route: "Passport", label: "พาสปอร์ตนก" },
  ] },
  { heading: "ลูกค้าและธุรกรรม", items: [
    { route: "Customers", label: "ข้อมูลลูกค้า" },
    { route: "Sales", label: "การขาย" },
    { route: "Giveaways", label: "มอบให้ฟรี" },
  ] },
  { heading: "ส่งออกจากฟาร์ม", items: [
    { route: "Delivery & Handover", label: "การจัดการส่งมอบ" },
  ] },
];

export function MvpShell() {
  const [route, setRoute] = useState<Route>("Dashboard");
  const [navigationRevision, setNavigationRevision] = useState(0);
  const mainRef = useRef<HTMLElement>(null);

  const navigate = (next: Route) => {
    setRoute(next);
    setNavigationRevision(current => current + 1);
  };

  useEffect(() => {
    if (navigationRevision === 0) return;
    if (mainRef.current) mainRef.current.scrollTop = 0;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [navigationRevision]);

  const menuButton = (item: { route: Route; label: string }) => <button key={item.route} className={route === item.route ? "active" : ""} aria-current={route === item.route ? "page" : undefined} onClick={() => navigate(item.route)}>{item.label}</button>;

  return <div className="mvp-shell">
    <aside className="mvp-nav" aria-label="เมนูหลัก">
      <div className="mvp-brand"><strong>Birds My Boss</strong><small>ระบบจัดการฟาร์ม</small></div>
      <nav>{menuButton(overview)}{groups.map(group => <section className="mvp-nav-group" aria-labelledby={`nav-${group.heading}`} key={group.heading}><h2 id={`nav-${group.heading}`}>{group.heading}</h2>{group.items.map(menuButton)}</section>)}</nav>
    </aside>
    <main className="mvp-main" ref={mainRef}>
      {route !== "Cages" && <div className="mvp-inner"><App key={navigationRevision} initialPage={route} /></div>}
      {route === "Cages" && <div className="mvp-cages-page"><MvpCages key={navigationRevision} /></div>}
    </main>
  </div>;
}
