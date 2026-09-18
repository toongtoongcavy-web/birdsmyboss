import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { PriceHistory } from "./PriceHistory";

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("./functions", () => ({ invoke: mocks.invoke, thaiError: () => "บันทึกไม่สำเร็จ" }));

afterEach(() => { cleanup(); mocks.invoke.mockReset(); });

it("renders existing Thai Price History rows and permits manual list or offer before a Sale-derived final", async () => {
  mocks.invoke.mockImplementation(async (operation: string) => operation === "listBirdPriceHistory" ? [
    { priceHistoryId: "private-list-id", amount: 2500.5, currency: "THB", effectiveOn: "2026-08-24", kind: "list", notes: "ฤดูกาลใหม่" },
    { priceHistoryId: "private-offer-id", amount: 2000, currency: "THB", effectiveOn: "2026-08-25", kind: "offer" },
    { priceHistoryId: "private-legacy-final-id", amount: 1750, currency: "THB", effectiveOn: "2026-08-26", kind: "final" },
  ] : { priceHistoryId: "new" });
  const onSaved = vi.fn();
  const { container } = render(<PriceHistory birdId="private-bird-id" onSaved={onSaved}/>);
  expect(await screen.findByText("2500.5 THB")).toBeTruthy();
  expect(container.textContent).not.toContain("private-list-id");
  expect(screen.getAllByText(/ราคาตั้งขาย/).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/ราคาที่เสนอ/).length).toBeGreaterThan(0);
  expect(screen.getByText(/ราคาสุดท้าย/)).toBeTruthy();
  const form = screen.getByRole("heading", { name: "บันทึกประวัติราคา" }).closest("form")!;
  const type = within(form).getByLabelText("ประเภทราคา");
  expect(within(type).getAllByRole("option").map(option => ({ value: (option as HTMLOptionElement).value, label: option.textContent }))).toEqual([{ value: "list", label: "ราคาตั้งขาย" }, { value: "offer", label: "ราคาที่เสนอ" }]);
  fireEvent.change(within(form).getByLabelText("ราคาประวัติ"), { target: { value: "1250.5" } });
  fireEvent.change(within(form).getByLabelText("วันที่มีผล"), { target: { value: "08242026" } });
  fireEvent.change(type, { target: { value: "offer" } });
  fireEvent.submit(form);
  await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith("createPriceHistory", { birdId: "private-bird-id", amount: 1250.5, currency: "THB", effectiveOn: "2026-08-24", kind: "offer" }));
});

it("keeps existing rows visible and hides manual entry after a Sale-derived final", async () => {
  mocks.invoke.mockResolvedValue([
    { priceHistoryId: "list", amount: 2500, currency: "THB", effectiveOn: "2026-08-24", kind: "list" },
    { priceHistoryId: "final", amount: 1750, currency: "THB", effectiveOn: "2026-08-26", kind: "final", sourceType: "sale", saleId: "sale" },
  ]);
  render(<PriceHistory birdId="private-bird-id" onSaved={vi.fn()}/>);
  expect(await screen.findByText("2500 THB")).toBeTruthy();
  expect(screen.getByText("1750 THB")).toBeTruthy();
  expect(screen.getByText("บันทึกอัตโนมัติจากการขาย")).toBeTruthy();
  expect(screen.getByText("มีราคาสุดท้ายจากการขายแล้ว ไม่สามารถเพิ่มราคาตั้งขายหรือราคาที่เสนอได้")).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "บันทึกประวัติราคา" })).toBeNull();
});
