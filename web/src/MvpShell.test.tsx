import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { MvpShell } from "./MvpShell";

const mocks = vi.hoisted(() => ({ navigated: vi.fn() }));
const appRoutes = ["Dashboard", "Birds", "Breeding", "Sales", "Giveaways", "Customers", "Delivery & Handover", "Passport"];
vi.mock("./App", () => ({ App: () => <div className="app"><aside className="nav">{appRoutes.map(route => <button key={route} onClick={() => mocks.navigated(route)}>{route}</button>)}</aside><main>App page</main></div> }));
vi.mock("./MvpCages", () => ({ MvpCages: () => <div>หน้าโครงสร้างกรง</div> }));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

it("renders the complete farm lifecycle menu in the approved grouped order", () => {
  render(<MvpShell />);
  const nav = screen.getByRole("complementary", { name: "เมนูหลัก" });
  expect(within(nav).getAllByRole("heading", { level: 2 }).map(node => node.textContent)).toEqual(["จัดการฟาร์ม", "ลูกค้าและธุรกรรม", "ส่งออกจากฟาร์ม"]);
  expect(within(nav).getAllByRole("button").map(button => button.textContent)).toEqual(["ภาพรวม", "ข้อมูลกรง", "ข้อมูลนก", "การเพาะพันธุ์", "พาสปอร์ตนก", "ข้อมูลลูกค้า", "การขาย", "มอบให้ฟรี", "การจัดการส่งมอบ"]);
});

it("keeps active highlighting and every existing destination reachable", async () => {
  render(<MvpShell />);
  const nav = screen.getByRole("complementary", { name: "เมนูหลัก" });
  const labels = ["ภาพรวม", "ข้อมูลกรง", "ข้อมูลนก", "การเพาะพันธุ์", "พาสปอร์ตนก", "ข้อมูลลูกค้า", "การขาย", "มอบให้ฟรี", "การจัดการส่งมอบ"];
  for (const label of labels) {
    const button = within(nav).getByRole("button", { name: label });
    fireEvent.click(button);
    expect(button.classList.contains("active")).toBe(true);
    expect(button.getAttribute("aria-current")).toBe("page");
    if (label === "ข้อมูลกรง") expect(screen.getByText("หน้าโครงสร้างกรง")).toBeTruthy();
  }
  await waitFor(() => expect(new Set(mocks.navigated.mock.calls.map(([route]) => route))).toEqual(new Set(appRoutes)));
});
