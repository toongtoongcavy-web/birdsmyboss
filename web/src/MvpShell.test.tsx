import { useEffect, useState } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MvpShell } from "./MvpShell";

const mocks = vi.hoisted(() => ({ reads: vi.fn(), writes: vi.fn(), cageReads: vi.fn(), scrollTo: vi.fn() }));
vi.mock("./App", () => ({ App: ({ initialPage }: { initialPage: string }) => {
  const [detail, setDetail] = useState<string | null>(null);
  useEffect(() => { mocks.reads(initialPage); }, [initialPage]);
  return <section aria-label={`module-${initialPage}`}><h1>{initialPage} root</h1>{detail ? <p>{detail}</p> : <button onClick={() => setDetail(initialPage === "Birds" ? "Bird Profile" : initialPage === "Sales" ? "Sale Detail" : initialPage === "Breeding" ? "Egg Detail" : initialPage === "Delivery & Handover" ? "Selected Sale Delivery Form" : `${initialPage} Detail`)}>เปิดรายละเอียด</button>}</section>;
} }));
vi.mock("./MvpCages", () => ({ MvpCages: () => { useEffect(() => { mocks.cageReads(); }, []); const [selected,setSelected]=useState(false); return <section><h1>Cages root</h1>{selected?<p>Selected Cage Form</p>:<button onClick={()=>setSelected(true)}>เลือกกรง</button>}</section>; } }));

beforeEach(() => { mocks.scrollTo.mockReset(); vi.stubGlobal("scrollTo", mocks.scrollTo); });
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals(); });

const nav = () => screen.getByRole("complementary", { name: "เมนูหลัก" });
const clickMenu = (label: string) => fireEvent.click(within(nav()).getByRole("button", { name: label }));

it("renders the complete farm lifecycle menu in the approved grouped order", () => {
  render(<MvpShell />);
  expect(within(nav()).getAllByRole("heading", { level: 2 }).map(node => node.textContent)).toEqual(["จัดการฟาร์ม", "ลูกค้าและธุรกรรม", "ส่งออกจากฟาร์ม"]);
  expect(within(nav()).getAllByRole("button").map(button => button.textContent)).toEqual(["ภาพรวม", "ข้อมูลกรง", "ข้อมูลนก", "การเพาะพันธุ์", "พาสปอร์ตนก", "ข้อมูลลูกค้า", "การขาย", "มอบให้ฟรี", "การจัดการส่งมอบ"]);
});

it.each([
  ["ข้อมูลนก", "Bird Profile", "Birds root"],
  ["การขาย", "Sale Detail", "Sales root"],
  ["การเพาะพันธุ์", "Egg Detail", "Breeding root"],
  ["การจัดการส่งมอบ", "Selected Sale Delivery Form", "Delivery & Handover root"],
])("resets %s detail or selection on an already-active menu click", (label, detail, root) => {
  render(<MvpShell />); clickMenu(label); fireEvent.click(screen.getByRole("button", { name: "เปิดรายละเอียด" })); expect(screen.getByText(detail)).toBeTruthy();
  const readsBefore = mocks.reads.mock.calls.length; clickMenu(label);
  expect(screen.queryByText(detail)).toBeNull(); expect(screen.getByRole("heading", { name: root })).toBeTruthy();
  expect(mocks.reads.mock.calls.length).toBe(readsBefore + 1);
});

it("switching menus and returning starts at root, refreshes reads, scrolls, and performs no writes", () => {
  render(<MvpShell />); clickMenu("ข้อมูลลูกค้า"); fireEvent.click(screen.getByRole("button", { name: "เปิดรายละเอียด" })); expect(screen.getByText("Customers Detail")).toBeTruthy();
  clickMenu("ข้อมูลกรง"); fireEvent.click(screen.getByRole("button", { name: "เลือกกรง" })); expect(screen.getByText("Selected Cage Form")).toBeTruthy();
  clickMenu("ข้อมูลลูกค้า"); expect(screen.queryByText("Customers Detail")).toBeNull(); expect(screen.getByRole("heading", { name: "Customers root" })).toBeTruthy();
  expect(mocks.reads).toHaveBeenCalledWith("Customers"); expect(mocks.cageReads).toHaveBeenCalledTimes(1);
  expect(mocks.scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: "auto" }); expect(mocks.writes).not.toHaveBeenCalled();
});

it("keeps active highlighting for every existing destination", () => {
  render(<MvpShell />);
  for (const label of ["ภาพรวม", "ข้อมูลกรง", "ข้อมูลนก", "การเพาะพันธุ์", "พาสปอร์ตนก", "ข้อมูลลูกค้า", "การขาย", "มอบให้ฟรี", "การจัดการส่งมอบ"]) {
    clickMenu(label); const button=within(nav()).getByRole("button",{name:label}); expect(button.classList.contains("active")).toBe(true); expect(button.getAttribute("aria-current")).toBe("page");
  }
});
