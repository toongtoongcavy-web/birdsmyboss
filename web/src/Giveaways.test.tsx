import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("./functions", () => ({ invoke: mocks.invoke, thaiError: () => "เกิดข้อผิดพลาด" }));

import { Giveaways } from "./Giveaways";

const birds = [{ birdId: "bird-internal", displayName: "นกทดสอบ", ringId: "GC-001", status: "active" }];
const customers = [{ customerId: "customer-internal", displayName: "ผู้ติดต่อ", status: "active" }];
const giveaway = { giveawayId: "giveaway-internal", birdId: "bird-internal", recipientName: "ผู้รับตามข้อตกลง", givenOn: "2026-08-23", status: "planned", bird: birds[0], customer: customers[0] };

beforeEach(() => { mocks.invoke.mockReset(); });
afterEach(() => { cleanup(); vi.clearAllMocks(); });

it("renders a Giveaway registry and creates a canonical Giveaway without displaying internal IDs", async () => {
  mocks.invoke.mockResolvedValue({ giveawayId: "new-giveaway" });
  const refresh = vi.fn().mockResolvedValue(undefined);
  render(<Giveaways giveaways={[giveaway]} birds={birds} customers={customers} onRefresh={refresh}/>);
  expect(screen.getByText("ผู้รับตามข้อตกลง")).toBeTruthy();
  expect(screen.queryByText("giveaway-internal")).toBeNull();
  fireEvent.change(screen.getByLabelText("นกสำหรับ Giveaway"), { target: { value: "bird-internal" } });
  fireEvent.change(screen.getByLabelText("Customer สำหรับ Giveaway"), { target: { value: "customer-internal" } });
  fireEvent.change(screen.getByLabelText("ผู้รับตามข้อตกลง"), { target: { value: "ผู้รับจริงในข้อตกลง" } });
  fireEvent.change(screen.getByLabelText("วันที่บันทึกข้อตกลง"), { target: { value: "08232026" } });
  fireEvent.click(screen.getByRole("button", { name: "สร้างรายการให้" }));
  await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith("createGiveaway", { birdId: "bird-internal", customerId: "customer-internal", recipientName: "ผู้รับจริงในข้อตกลง", givenOn: "2026-08-23" }));
});

it("shows contextual lifecycle actions and keeps Customer distinct from Handover recipientSnapshot", async () => {
  const detail = { ...giveaway, handover: null };
  mocks.invoke.mockImplementation(async (operation: string) => operation === "getGiveawayDetails" ? detail : {});
  render(<Giveaways giveaways={[giveaway]} birds={birds} customers={customers} onRefresh={vi.fn().mockResolvedValue(undefined)}/>);
  fireEvent.click(screen.getAllByRole("button", { name: /ผู้รับตามข้อตกลง/i })[0]);
  expect(await screen.findByText("ผู้รับตามข้อตกลง")).toBeTruthy();
  expect(screen.getByText(/ไม่ถูกใช้แทน recipientSnapshot/)).toBeTruthy();
  fireEvent.click(screen.getByText("ยืนยันข้อตกลงให้"));
  await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith("completeGiveaway", { giveawayId: "giveaway-internal" }));
});

it("submits only a structured recipientSnapshot for a completed Giveaway Handover", async () => {
  const detail = { ...giveaway, status: "completed", handover: null };
  mocks.invoke.mockImplementation(async (operation: string) => operation === "getGiveawayDetails" ? detail : {});
  render(<Giveaways giveaways={[detail]} birds={birds} customers={customers} onRefresh={vi.fn().mockResolvedValue(undefined)}/>);
  fireEvent.click(screen.getAllByRole("button", { name: /ผู้รับตามข้อตกลง/i })[0]);
  await screen.findByText("ส่งมอบจริง");
  fireEvent.change(screen.getByLabelText("ชื่อผู้รับจริง"), { target: { value: "ผู้รับ snapshot" } });
  fireEvent.change(screen.getByLabelText("วันที่ส่งมอบ giveaway"), { target: { value: "08242026" } });
  fireEvent.click(screen.getByText("ยืนยันการส่งมอบ"));
  await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith("completeHandover", { sourceType: "giveaway", giveawayId: "giveaway-internal", birdId: "bird-internal", handoverOn: "2026-08-24", recipientSnapshot: { name: "ผู้รับ snapshot" } }));
});
