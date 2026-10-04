import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
  const historicalGiveaway = { ...giveaway, birdId: "historical-bird", bird: { ...birds[0], birdId: "historical-bird", ringId: "GC-HISTORY" } };
  render(<Giveaways giveaways={[historicalGiveaway]} birds={birds} customers={customers} onRefresh={refresh}/>);
  expect(screen.getByText("ผู้รับตามข้อตกลง")).toBeTruthy();
  expect(screen.queryByText("giveaway-internal")).toBeNull();
  fireEvent.change(screen.getByLabelText("นกสำหรับ Giveaway"), { target: { value: "bird-internal" } });
  fireEvent.change(screen.getByLabelText("Customer สำหรับ Giveaway"), { target: { value: "customer-internal" } });
  fireEvent.change(screen.getByLabelText("ผู้รับตามข้อตกลง"), { target: { value: "ผู้รับจริงในข้อตกลง" } });
  fireEvent.change(screen.getByLabelText("วันที่บันทึกข้อตกลง"), { target: { value: "23082026" } });
  fireEvent.click(screen.getByRole("button", { name: "สร้างรายการให้" }));
  await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith("createGiveaway", { birdId: "bird-internal", customerId: "customer-internal", recipientName: "ผู้รับจริงในข้อตกลง", givenOn: "2026-08-23" }));
});

it("GIVE-02 excludes every terminal Bird from the selector while keeping an active Bird eligible", () => {
  const statusBirds = ["sold", "given_away", "deceased", "lost"].map(status => ({ birdId: `bird-${status}`, displayName: `นก ${status}`, ringId: `RING-${status}`, status }));
  render(<Giveaways giveaways={[]} birds={[...birds, ...statusBirds]} customers={customers} onRefresh={vi.fn().mockResolvedValue(undefined)}/>);
  const selector = screen.getByLabelText("นกสำหรับ Giveaway");
  expect(within(selector).getByRole("option", { name: /GC-001/ })).toBeTruthy();
  for (const status of ["sold", "given_away", "deceased", "lost"]) {
    expect(within(selector).queryByRole("option", { name: new RegExp(`RING-${status}`) })).toBeNull();
  }
});

it("excludes commercially committed Birds from Giveaway and restores cancelled commitments", () => {
  const committedBirds = [
    { birdId: "free", displayName: "Free", ringId: "FREE", status: "active" },
    { birdId: "reserved", displayName: "Reserved", ringId: "RESERVED", status: "active" },
    ...["draft", "confirmed", "completed", "cancelled"].map(status => ({ birdId: `sale-${status}`, displayName: status, ringId: `SALE-${status}`, status: "active" })),
    ...["planned", "completed", "cancelled"].map(status => ({ birdId: `giveaway-${status}`, displayName: status, ringId: `GIVE-${status}`, status: "active" })),
  ];
  render(<Giveaways
    giveaways={["planned", "completed", "cancelled"].map(status => ({ giveawayId: `g-${status}`, birdId: `giveaway-${status}`, status }))}
    birds={committedBirds}
    customers={customers}
    reservations={[{ reservationId: "r-active", birdId: "reserved", status: "active" }]}
    sales={["draft", "confirmed", "completed", "cancelled"].map(status => ({ saleId: `s-${status}`, birdId: `sale-${status}`, status }))}
    onRefresh={vi.fn().mockResolvedValue(undefined)}
  />);
  const selector = screen.getByLabelText("นกสำหรับ Giveaway");
  for (const ringId of ["FREE", "SALE-cancelled", "GIVE-cancelled"]) expect(within(selector).getByRole("option", { name: new RegExp(ringId) })).toBeTruthy();
  for (const ringId of ["RESERVED", "SALE-draft", "SALE-confirmed", "SALE-completed", "GIVE-planned", "GIVE-completed"]) expect(within(selector).queryByRole("option", { name: new RegExp(ringId) })).toBeNull();
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
  fireEvent.change(screen.getByLabelText("วันที่ส่งมอบ giveaway"), { target: { value: "24082026" } });
  fireEvent.click(screen.getByText("ยืนยันการส่งมอบ"));
  await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith("completeHandover", { sourceType: "giveaway", giveawayId: "giveaway-internal", birdId: "bird-internal", handoverOn: "2026-08-24", recipientSnapshot: { name: "ผู้รับ snapshot" } }));
});
