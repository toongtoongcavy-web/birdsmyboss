import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ invoke: vi.fn(async (name?: string) => String(name).startsWith("list") ? [] : name === "getDashboardSummary" ? {} : {}) }));
vi.mock("./functions", () => ({ invoke: mocks.invoke, thaiError: () => "เกิดข้อผิดพลาด กรุณาลองใหม่" }));
import { App } from "./App";

const page = async (name: string) => fireEvent.click(await screen.findByRole("button", { name }));
beforeEach(() => { mocks.invoke.mockClear(); render(<App />); });
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it("sale and delivery pages retain their trusted workflow entry points", async () => { await page("Sales"); expect(screen.getByRole("heading", { name: "การจอง", level: 3 })).toBeTruthy(); expect(screen.getByRole("heading", { name: "การขาย", level: 3 })).toBeTruthy(); await page("Delivery & Handover"); expect(screen.getByRole("heading",{name:"การจัดส่ง",level:2})).toBeTruthy();expect(screen.getByRole("heading",{name:"การส่งมอบ",level:2})).toBeTruthy();expect(screen.getAllByLabelText("ค้นหาการขายที่ปิดแล้ว")).toHaveLength(2); });
it("does not expose raw Delivery/Handover ID forms", async () => { await page("Delivery & Handover"); expect(document.body.textContent).not.toContain("Completed Sale ID"); expect(document.body.textContent).not.toContain("Bird ID"); expect(document.body.textContent).not.toContain("JSON"); });
