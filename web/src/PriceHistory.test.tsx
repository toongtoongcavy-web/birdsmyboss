import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { PriceHistory } from "./PriceHistory";

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("./functions", () => ({ invoke: mocks.invoke, thaiError: () => "บันทึกไม่สำเร็จ" }));

afterEach(() => { cleanup(); mocks.invoke.mockReset(); });

const options = () => {
  const select = screen.getByLabelText("ประเภทราคา");
  return within(select).getAllByRole("option").map(option => ({ value: (option as HTMLOptionElement).value, label: option.textContent }));
};

it("offers purchase, list, and offer in Thai for an external Bird and submits purchase canonically", async () => {
  mocks.invoke.mockImplementation(async (operation: string) => operation === "listBirdPriceHistory" ? [
    { priceHistoryId: "purchase", amount: 900, currency: "THB", effectiveOn: "2026-08-23", kind: "purchase" },
    { priceHistoryId: "list", amount: 2500.5, currency: "THB", effectiveOn: "2026-08-24", kind: "list" },
    { priceHistoryId: "offer", amount: 2000, currency: "THB", effectiveOn: "2026-08-25", kind: "offer" },
    { priceHistoryId: "legacy-final", amount: 1750, currency: "THB", effectiveOn: "2026-08-26", kind: "final" },
  ] : { priceHistoryId: "new" });
  render(<PriceHistory birdId="external-bird" origin="external" onSaved={vi.fn()}/>);
  expect(await screen.findByText("900 THB")).toBeTruthy();
  expect(screen.getAllByText(/ราคาซื้อเข้า/).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/ราคาสุดท้าย/).length).toBeGreaterThan(0);
  expect(options()).toEqual([
    { value: "purchase", label: "ราคาซื้อเข้า" },
    { value: "list", label: "ราคาตั้งขาย" },
    { value: "offer", label: "ราคาที่เสนอ" },
  ]);
  const form = screen.getByRole("heading", { name: "บันทึกประวัติราคา" }).closest("form")!;
  fireEvent.change(within(form).getByLabelText("ราคาประวัติ"), { target: { value: "1250.5" } });
  fireEvent.change(within(form).getByLabelText("วันที่มีผล"), { target: { value: "08242026" } });
  fireEvent.submit(form);
  await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith("createPriceHistory", { birdId: "external-bird", amount: 1250.5, currency: "THB", effectiveOn: "2026-08-24", kind: "purchase" }));
});

it("offers only list and offer for a farm-hatched Bird", async () => {
  mocks.invoke.mockResolvedValue([]);
  render(<PriceHistory birdId="farm-bird" origin="farm_hatched" onSaved={vi.fn()}/>);
  await screen.findByText("ยังไม่มีประวัติราคา");
  expect(options()).toEqual([
    { value: "list", label: "ราคาตั้งขาย" },
    { value: "offer", label: "ราคาที่เสนอ" },
  ]);
  expect(screen.queryByRole("option", { name: "ราคาซื้อเข้า" })).toBeNull();
});

it("locks selling prices after a Sale-derived final but still allows external purchase cost", async () => {
  mocks.invoke.mockImplementation(async (operation: string) => operation === "listBirdPriceHistory" ? [
    { priceHistoryId: "list", amount: 2500, currency: "THB", effectiveOn: "2026-08-24", kind: "list" },
    { priceHistoryId: "final", amount: 1750, currency: "THB", effectiveOn: "2026-08-26", kind: "final", sourceType: "sale", saleId: "sale" },
  ] : { priceHistoryId: "new" });
  render(<PriceHistory birdId="external-bird" origin="external" onSaved={vi.fn()}/>);
  expect(await screen.findByText("1750 THB")).toBeTruthy();
  expect(screen.getByText("บันทึกอัตโนมัติจากการขาย")).toBeTruthy();
  expect(screen.getByText("มีราคาสุดท้ายจากการขายแล้ว ราคาตั้งขายและราคาที่เสนอถูกล็อก แต่ยังบันทึกราคาซื้อเข้าได้")).toBeTruthy();
  expect(options()).toEqual([{ value: "purchase", label: "ราคาซื้อเข้า" }]);
  expect(screen.getByRole("heading", { name: "บันทึกประวัติราคา" })).toBeTruthy();
});

it("keeps existing rows visible and hides all manual pricing for a farm-hatched Bird after final", async () => {
  mocks.invoke.mockResolvedValue([
    { priceHistoryId: "offer", amount: 2000, currency: "THB", effectiveOn: "2026-08-25", kind: "offer" },
    { priceHistoryId: "final", amount: 1750, currency: "THB", effectiveOn: "2026-08-26", kind: "final", sourceType: "sale", saleId: "sale" },
  ]);
  render(<PriceHistory birdId="farm-bird" origin="farm_hatched" onSaved={vi.fn()}/>);
  expect(await screen.findByText("2000 THB")).toBeTruthy();
  expect(screen.getByText("1750 THB")).toBeTruthy();
  expect(screen.getByText("มีราคาสุดท้ายจากการขายแล้ว ไม่สามารถเพิ่มราคาตั้งขายหรือราคาที่เสนอได้")).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "บันทึกประวัติราคา" })).toBeNull();
});
