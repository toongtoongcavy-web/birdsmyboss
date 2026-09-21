import { cleanup, render, screen, within } from "@testing-library/react";
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
  const pair = screen.getByRole("heading", { name: "คู่ผสมพันธุ์ + กรงคู่ผสมพันธุ์" }).closest("section")!;
  const current = screen.getByRole("heading", { name: "นกและกรงปัจจุบัน" }).closest("section")!;
  expect(within(move).getByRole("option", { name: /ACTIVE-1/ })).toBeTruthy();
  expect(within(pair).getByRole("option", { name: /ACTIVE-1/ })).toBeTruthy();
  expect(within(current).getByText(/ACTIVE-1/)).toBeTruthy();
  for (const ring of ["SOLD-1", "GIVEN-1", "DEAD-1", "LOST-1"]) {
    expect(within(move).queryByRole("option", { name: new RegExp(ring) })).toBeNull();
    expect(within(pair).queryByRole("option", { name: new RegExp(ring) })).toBeNull();
    expect(within(current).queryByText(new RegExp(ring))).toBeNull();
  }
});
