import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { PriceHistory } from "./PriceHistory";

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("./functions", () => ({ invoke: mocks.invoke, thaiError: () => "บันทึกไม่สำเร็จ" }));

afterEach(() => { cleanup(); mocks.invoke.mockReset(); });

it("renders append-only Price History and records an explicit THB entry", async () => {
  mocks.invoke.mockImplementation(async (operation: string) => operation === "listBirdPriceHistory" ? [{ priceHistoryId: "private-price-id", amount: 2500.5, currency: "THB", effectiveOn: "2026-08-24", kind: "list", notes: "ฤดูกาลใหม่" }] : { priceHistoryId: "new" });
  const onSaved = vi.fn();
  const { container } = render(<PriceHistory birdId="private-bird-id" onSaved={onSaved}/>);
  expect(await screen.findByText("2500.5 THB")).toBeTruthy();
  expect(container.textContent).not.toContain("private-price-id");
  const form = screen.getByRole("heading", { name: "บันทึกประวัติราคา" }).closest("form")!;
  fireEvent.change(within(form).getByLabelText("ราคาประวัติ"), { target: { value: "1250.5" } });
  fireEvent.change(within(form).getByLabelText("วันที่มีผล"), { target: { value: "08242026" } });
  fireEvent.change(within(form).getByLabelText("ประเภทราคา"), { target: { value: "offer" } });
  fireEvent.submit(form);
  await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith("createPriceHistory", { birdId: "private-bird-id", amount: 1250.5, currency: "THB", effectiveOn: "2026-08-24", kind: "offer" }));
});
