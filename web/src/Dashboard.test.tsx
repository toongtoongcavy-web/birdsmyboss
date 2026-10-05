import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Dashboard } from "./Dashboard";

const today = new Date().toISOString().slice(0, 10);
const data = {
  listBirds: [{ status: "active" }, { status: "active" }, { status: "sold" }],
  listMvpCages: [{ status: "active", occupancyCount: 0 }, { status: "active", occupancyCount: 2 }, { status: "inactive", occupancyCount: 0 }],
  listPairs: [{ status: "active" }],
  listBreedingCycles: [{ status: "active" }],
  listReservations: [{ status: "active", expiresOn: today }],
  listSales: [{ status: "draft" }, { status: "completed" }],
  listDeliveries: [{ status: "scheduled", scheduledOn: today }],
};

afterEach(cleanup);

describe("calm Dashboard", () => {
  it("shows exactly four meaningful metrics and only non-zero attention rows", () => {
    const { container } = render(<Dashboard data={data} summary={{ activePairs: 1, activeReservations: 1, pendingDeliveries: 1 }} navigate={() => {}} />);
    expect(screen.getByRole("heading", { name: "ภาพรวมฟาร์ม" })).toBeTruthy();
    expect(screen.getByText("วันนี้ฟาร์มเป็นอย่างไรบ้าง")).toBeTruthy();
    const metrics = screen.getByLabelText("สรุปฟาร์ม");
    expect(within(metrics).getAllByRole("article")).toHaveLength(4);
    for (const label of ["นกในฟาร์ม", "คู่เพาะใช้งาน", "กรงว่าง", "งานที่ต้องติดตาม"]) expect(within(metrics).getByText(label)).toBeTruthy();
    expect(screen.getByText("ต้องทำวันนี้ / เร่งด่วน")).toBeTruthy();
    expect(screen.getByText("กำลังดำเนินการ")).toBeTruthy();
    expect(screen.getByText("การจองครบกำหนดวันนี้ / เลยกำหนด")).toBeTruthy();
    expect(screen.getByText("กำหนดส่งมอบวันนี้")).toBeTruthy();
    expect(container.querySelectorAll(".today-row")).toHaveLength(4);
    fireEvent.click(screen.getByRole("button", { name: "ดูทั้งหมด" }));
    expect(screen.getByText("รอบเพาะที่ใช้งาน")).toBeTruthy();
    expect(screen.getByText("การจองที่ใช้งาน")).toBeTruthy();
    expect(container.querySelectorAll(".today-row")).toHaveLength(6);
    expect(screen.queryByText("Passport ที่เผยแพร่")).toBeNull();
  });

  it("shows a calm success state and conceals zero-value attention rows", () => {
    render(<Dashboard data={{ listBirds: [], listMvpCages: [] }} summary={{ activePairs: 0, activeReservations: 0, pendingDeliveries: 0 }} navigate={() => {}} />);
    expect(screen.getByText("วันนี้ทุกอย่างเรียบร้อยดี")).toBeTruthy();
    expect(screen.getByText("ไม่มีงานเร่งด่วนที่ต้องจัดการ")).toBeTruthy();
    expect(screen.queryByText("การจองที่ใช้งาน")).toBeNull();
    expect(screen.queryByText("การขายที่ยังไม่เสร็จ")).toBeNull();
  });

  it("keeps only the four approved compact workflow actions", () => {
    const navigate = vi.fn();
    render(<Dashboard data={{}} summary={null} navigate={navigate} />);
    const actions = screen.getByRole("heading", { name: "เริ่มงาน" }).closest("section")!;
    const expected = [["เพิ่มนก", "Birds"], ["สร้างคู่", "Breeding"], ["เพิ่มไข่", "Breeding"], ["สร้างการจอง", "Sales"]] as const;
    expect(within(actions).getAllByRole("button")).toHaveLength(4);
    for (const [name, page] of expected) { fireEvent.click(within(actions).getByRole("button", { name })); expect(navigate).toHaveBeenLastCalledWith(page); }
    expect(screen.queryByRole("button", { name: "เพิ่มลูกค้า" })).toBeNull();
  });
});
