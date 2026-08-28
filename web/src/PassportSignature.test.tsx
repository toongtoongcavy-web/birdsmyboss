import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("./functions", () => ({ invoke: mocks.invoke, thaiError: () => "เกิดข้อผิดพลาด" }));
import { PublicPassport } from "./components/PublicPassport";

afterEach(() => { cleanup(); vi.clearAllMocks(); });

it("presents selective public evidence and provenance without private commercial data", async () => {
  mocks.invoke.mockResolvedValue({
    ringId: "PUBLIC-8", mutation: "Blue", sex: "female", hatchedOn: "2026-08-14", origin: "farm_hatched", handoverOn: "2026-09-01",
    parentage: { male: { ringId: "SIRE-8" }, female: { ringId: "DAM-8" } },
    photos: [{ publicUrl: "https://example.test/bird.jpg", caption: "ภาพเผยแพร่", sortOrder: 1 }],
    documents: [{ documentType: "DNA", issuedOn: "2026-08-20", documentNumber: "DNA-8" }],
  });
  render(<PublicPassport publicToken="public-token"/>);
  await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith("getBirdPassport", { publicToken: "public-token" }));
  expect(await screen.findByText("THE LIVING RECORD")).toBeTruthy();
  expect(screen.getByText("SIRE-8")).toBeTruthy();
  expect(screen.getByText("DAM-8")).toBeTruthy();
  expect(screen.getByAltText("ภาพเผยแพร่")).toBeTruthy();
  expect(screen.getByText("DNA")).toBeTruthy();
  expect(screen.getByText("วันส่งมอบ: 01/09/2026")).toBeTruthy();
  expect(document.body.textContent).not.toMatch(/customer|payment|saleId|storagePath|checksum/i);
});
