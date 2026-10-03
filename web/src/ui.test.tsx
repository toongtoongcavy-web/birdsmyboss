import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BirdStatusBadge, EmptyState, PageHeader, SectionCard, StatCard, StatusBadge, birdVisualClass } from "./ui";

describe("product UI primitives", () => {
  it("renders a consistent page hierarchy and reusable cards", () => {
    render(<><PageHeader title="ทะเบียนนก" subtitle="ข้อมูลนกในฟาร์ม"/><SectionCard title="นกทั้งหมด"><StatCard label="นก Active" value={12}/></SectionCard></>);
    expect(screen.getByRole("heading", { level: 1, name: "ทะเบียนนก" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "นกทั้งหมด" })).toBeTruthy();
    expect(screen.getByText("นกที่ใช้งาน")).toBeTruthy();
    expect(screen.getByText("12").closest("article")?.className).toContain("stat-card");
  });

  it("maps canonical statuses to semantic badges without changing their labels", () => {
    const { rerender } = render(<StatusBadge status="active"/>);
    expect(screen.getByText("อยู่ในฟาร์ม").className).toContain("status-success");
    rerender(<StatusBadge status="draft"/>);
    expect(screen.getByText("แบบร่าง").className).toContain("status-warning");
    rerender(<StatusBadge status="cancelled"/>);
    expect(screen.getByText("ยกเลิก").className).toContain("status-danger");
  });

  it("scopes current and terminal visual treatments to Bird status", () => {
    expect(birdVisualClass("active")).toBe("bird-visual-current");
    for (const status of ["sold", "given_away", "deceased", "lost"]) expect(birdVisualClass(status)).toBe("bird-visual-terminal");
    const { rerender } = render(<BirdStatusBadge status="active"/>);
    expect(screen.getByText("อยู่ในฟาร์ม").className).toContain("bird-visual-current");
    rerender(<BirdStatusBadge status="sold"/>);
    expect(screen.getByText("ขายแล้ว").className).toContain("bird-visual-terminal");
    rerender(<StatusBadge status="active" label="ลูกค้าใช้งานอยู่"/>);
    expect(screen.getByText("ลูกค้าใช้งานอยู่").className).not.toContain("bird-visual-");
  });

  it("provides a readable empty state", () => {
    render(<EmptyState title="ยังไม่มีนก" description="เพิ่มนกเพื่อเริ่มต้น"/>);
    expect(screen.getByText("ยังไม่มีนก")).toBeTruthy();
    expect(screen.getByText("เพิ่มนกเพื่อเริ่มต้น")).toBeTruthy();
  });
});
