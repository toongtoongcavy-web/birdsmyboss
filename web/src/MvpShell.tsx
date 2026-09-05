import { useEffect, useState } from "react";
import { App } from "./App";
import { MvpCages } from "./MvpCages";
import "./MvpShell.css";

type Route = "Dashboard" | "Birds" | "Cages" | "Breeding" | "Sales" | "Giveaways" | "Customers" | "Delivery & Handover" | "Passport";

const items: Array<{ route: Route; label: string }> = [
  { route: "Dashboard", label: "ภาพรวม" },
  { route: "Birds", label: "ข้อมูลนก" },
  { route: "Cages", label: "ข้อมูลกรง" },
  { route: "Breeding", label: "การเพาะพันธุ์" },
  { route: "Sales", label: "การขาย" },
  { route: "Giveaways", label: "มอบให้ฟรี" },
  { route: "Customers", label: "ข้อมูลลูกค้า" },
  { route: "Delivery & Handover", label: "การจัดการส่งมอบ" },
  { route: "Passport", label: "พาสปอร์ตนก" },
];

const appRoutes: Exclude<Route, "Cages">[] = ["Dashboard", "Birds", "Breeding", "Sales", "Giveaways", "Customers", "Delivery & Handover", "Passport"];

export function MvpShell() {
  const [route, setRoute] = useState<Route>("Dashboard");

  const navigate = (next: Route) => {
    setRoute(next);
    if (next === "Cages") return;
    const index = appRoutes.indexOf(next);
    window.setTimeout(() => {
      const buttons = document.querySelectorAll<HTMLButtonElement>(".mvp-inner .app > aside.nav button");
      buttons[index]?.click();
    }, 0);
  };

  useEffect(() => { navigate("Dashboard"); }, []);

  return <div className="mvp-shell">
    <aside className="mvp-nav" aria-label="เมนูหลัก">
      <div className="mvp-brand"><strong>Birds My Boss</strong><small>ระบบจัดการฟาร์ม</small></div>
      <nav>{items.map(item => <button key={item.route} className={route === item.route ? "active" : ""} onClick={() => navigate(item.route)}>{item.label}</button>)}</nav>
    </aside>
    <main className="mvp-main">
      <div className={route === "Cages" ? "mvp-inner is-hidden" : "mvp-inner"}><App /></div>
      {route === "Cages" && <div className="mvp-cages-page"><MvpCages /></div>}
    </main>
  </div>;
}
