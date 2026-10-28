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
  const drawerRef = useRef<HTMLDialogElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const currentLabel = [overview, ...groups.flatMap(group => group.items)].find(item => item.route === route)!.label;

  const closeMenu = () => {
    drawerRef.current?.close();
    setMenuOpen(false);
  };

  useEffect(() => {
    if (!menuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const desktop = window.matchMedia("(min-width: 841px) and (orientation: landscape)");
    const onResize = () => { if (desktop.matches) closeMenu(); };
    desktop.addEventListener("change", onResize);
    return () => {
      document.body.style.overflow = previousOverflow;
      desktop.removeEventListener("change", onResize);
    };
  }, [menuOpen]);

  const navigate = (next: Route) => {
    closeMenu();
    setRoute(next);
    setNavigationRevision(current => current + 1);
  };

  useEffect(() => {
    if (navigationRevision === 0) return;
    if (mainRef.current) mainRef.current.scrollTop = 0;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [navigationRevision]);

  const menuButton = (item: { route: Route; label: string }) => <button key={item.route} className={route === item.route ? "active" : ""} aria-current={route === item.route ? "page" : undefined} onClick={() => navigate(item.route)}>{item.label}</button>;
  const navigation = (prefix: string) => <nav aria-label="เมนูหลัก">{menuButton(overview)}{groups.map(group => <section className="mvp-nav-group" aria-labelledby={`${prefix}-${group.heading}`} key={group.heading}><h2 id={`${prefix}-${group.heading}`}>{group.heading}</h2>{group.items.map(menuButton)}</section>)}</nav>;

  return <div className="mvp-shell">
    <header className="mvp-topbar">
      <div><strong>Birds My Boss</strong><span>{currentLabel}</span></div>
      <button ref={menuRef} type="button" aria-label="เปิดเมนูหลัก" aria-haspopup="dialog" aria-expanded={menuOpen} aria-controls="mvp-drawer" onClick={() => {
        drawerRef.current?.showModal();
        setMenuOpen(true);
        drawerRef.current?.querySelector<HTMLButtonElement>('[aria-current="page"]')?.focus();
      }}><span aria-hidden="true">☰</span></button>
    </header>
    <aside className="mvp-nav" aria-label="เมนูหลัก">
      <div className="mvp-brand"><strong>Birds My Boss</strong><small>ระบบจัดการฟาร์ม</small></div>
      {navigation("sidebar")}
    </aside>
    <dialog id="mvp-drawer" className="mvp-drawer" ref={drawerRef} aria-labelledby="mvp-drawer-title" onCancel={closeMenu} onClose={() => { setMenuOpen(false); if (menuRef.current?.getClientRects().length) menuRef.current.focus(); }} onClick={event => {
      if (event.target !== event.currentTarget) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closeMenu();
    }}>
      <div className="mvp-drawer-heading"><strong id="mvp-drawer-title">Birds My Boss</strong><button type="button" aria-label="ปิดเมนูหลัก" onClick={closeMenu}>×</button></div>
      {navigation("drawer")}
    </dialog>
    <main className="mvp-main" ref={mainRef}>
      {route !== "Cages" && <div className="mvp-inner"><App key={navigationRevision} initialPage={route} /></div>}
      {route === "Cages" && <div className="mvp-cages-page"><MvpCages key={navigationRevision} /></div>}
    </main>
  </div>;
}
