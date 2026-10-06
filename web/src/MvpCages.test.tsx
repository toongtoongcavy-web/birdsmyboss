import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { MvpCages } from "./MvpCages";

const invoke = vi.hoisted(() => vi.fn());
vi.mock("./functions", () => ({ invoke, thaiError: () => "เกิดข้อผิดพลาด" }));
afterEach(() => { cleanup(); invoke.mockReset(); });

it("shows only current farm birds in cage operations and current-cage readback", async () => {
  invoke.mockImplementation(async (operation: string) => operation === "listMvpCages"
    ? [{ cageId: "c1", code: "A1", name: "กรงหนึ่ง", status: "active", type: "breeding", occupancyCount: 1 }]
    : [
      { birdId: "active", ringId: "ACTIVE-1", displayName: "Current", currentSex: "male", status: "active" },
      { birdId: "sold", ringId: "SOLD-1", displayName: "Sold", currentSex: "male", status: "sold" },
      { birdId: "given", ringId: "GIVEN-1", displayName: "Given", currentSex: "female", status: "given_away" },
      { birdId: "dead", ringId: "DEAD-1", displayName: "Dead", currentSex: "male", status: "deceased" },
      { birdId: "lost", ringId: "LOST-1", displayName: "Lost", currentSex: "female", status: "lost" },
    ]);
  render(<MvpCages />);
  const move = (await screen.findByRole("heading", { name: "การจัดนกเข้ากรง" })).closest("form")!;
  const pair = screen.getByRole("heading", { name: "จับคู่ผสมพันธุ์ + กรงคู่ผสมพันธุ์" }).closest("section")!;
  const current = screen.getByRole("heading", { name: "นกและกรงปัจจุบัน" }).closest("section")!;
  expect(await within(move).findByRole("option", { name: /ACTIVE-1/ })).toBeTruthy();
  expect(within(pair).getByRole("option", { name: /ACTIVE-1/ })).toBeTruthy();
  expect(within(current).getByText(/ACTIVE-1/)).toBeTruthy();
  const moveDate=within(move).getByLabelText("วันที่ย้ายกรง") as HTMLInputElement;
  fireEvent.click(moveDate);
  fireEvent.change(moveDate,{target:{value:"27/092026"}});
  expect(document.activeElement).toBe(moveDate);
  expect(moveDate.value).toBe("27/09/2026");
  for (const ring of ["SOLD-1", "GIVEN-1", "DEAD-1", "LOST-1"]) {
    expect(within(move).queryByRole("option", { name: new RegExp(ring) })).toBeNull();
    expect(within(pair).queryByRole("option", { name: new RegExp(ring) })).toBeNull();
    expect(within(current).queryByText(new RegExp(ring))).toBeNull();
  }
});

it("presents cage summaries and filters the cage and current-Bird registries", async () => {
  invoke.mockImplementation(async (operation: string) => operation === "listMvpCages" ? [
    { cageId: "c1", code: "A1", name: "กรงเพาะหนึ่ง", status: "active", type: "breeding", occupancyCount: 1, capacity: 2 },
    { cageId: "c2", code: "H1", name: "กรงพัก", status: "maintenance", type: "holding", occupancyCount: 0, capacity: 4 },
  ] : [
    { birdId: "b1", ringId: "RING-01", displayName: "นกหนึ่ง", currentSex: "female", status: "active", currentCageCode: "A1", currentCageName: "กรงเพาะหนึ่ง" },
    { birdId: "b2", ringId: "RING-02", displayName: "นกสอง", currentSex: "male", status: "active" },
  ]);
  render(<MvpCages />);
  const summary = await screen.findByLabelText("สรุปข้อมูลกรง");
  expect(within(summary).getByText("กรงทั้งหมด").parentElement?.textContent).toContain("2");
  expect(within(summary).getByText("กรงว่าง").parentElement?.textContent).toContain("1");
  expect(within(summary).getByText("กรงที่มีนก").parentElement?.textContent).toContain("1");
  fireEvent.change(screen.getByLabelText("ค้นหากรง"), { target: { value: "H1" } });
  expect(screen.getByText("กรงพัก")).toBeTruthy();
  expect(screen.queryByText("กรงเพาะหนึ่ง", { selector: "td" })).toBeNull();
  fireEvent.change(screen.getByLabelText("ค้นหานกในกรง"), { target: { value: "RING-02" } });
  const birdPanel = screen.getByRole("heading", { name: "นกและกรงปัจจุบัน" }).closest("section")!;
  expect(within(birdPanel).getByText("RING-02")).toBeTruthy();
  expect(within(birdPanel).queryByText("RING-01")).toBeNull();
});
