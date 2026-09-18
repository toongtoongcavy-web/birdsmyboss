import { useEffect, useState } from "react";
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

  useEffect(() => {
    const attach = () => {
      const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>(".mvp-inner .app > aside.nav button"));
      if (!buttons.length) return undefined;
      const sync = () => {
        const index = buttons.findIndex(button => button.classList.contains("active"));
        if (index >= 0) setRoute(current => current === "Cages" ? current : appRoutes[index]);
      };
      const observer = new MutationObserver(sync);
      buttons.forEach(button => observer.observe(button, { attributes: true, attributeFilter: ["class"] }));
      sync();
      return () => observer.disconnect();
    };
    let cleanup = attach();
    if (cleanup) return cleanup;
    const timer = window.setTimeout(() => { cleanup = attach(); }, 0);
    return () => { window.clearTimeout(timer); cleanup?.(); };
  }, []);

  const menuButton = (item: { route: Route; label: string }) => <button key={item.route} className={route === item.route ? "active" : ""} aria-current={route === item.route ? "page" : undefined} onClick={() => navigate(item.route)}>{item.label}</button>;

  return <div className="mvp-shell">
    <aside className="mvp-nav" aria-label="เมนูหลัก">
      <div className="mvp-brand"><strong>Birds My Boss</strong><small>ระบบจัดการฟาร์ม</small></div>
      <nav>{menuButton(overview)}{groups.map(group => <section className="mvp-nav-group" aria-labelledby={`nav-${group.heading}`} key={group.heading}><h2 id={`nav-${group.heading}`}>{group.heading}</h2>{group.items.map(menuButton)}</section>)}</nav>
    </aside>
    <main className="mvp-main">
      <div className={route === "Cages" ? "mvp-inner is-hidden" : "mvp-inner"}><App /></div>
      {route === "Cages" && <div className="mvp-cages-page"><MvpCages /></div>}
    </main>
  </div>;
}
