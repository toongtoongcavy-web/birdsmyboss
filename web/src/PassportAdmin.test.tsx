import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(async () => ({})),
}));

vi.mock("./functions", () => ({
  invoke: mocks.invoke,
  thaiError: () => "เกิดข้อผิดพลาด",
}));

import { PassportAdmin } from "./components/PassportAdmin";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it("admin status, token confirmation, and asset publication use trusted calls", async () => {
  const onChanged = vi.fn(async () => {});
  render(
    <PassportAdmin
      birdId="b1"
      photos={[{ photoId: "p1", caption: "Photo", isPublicOnPassport: false, storagePath: "secret", checksum: "secret" }]}
      documents={[{ documentId: "d1", documentType: "DNA", isPublicOnPassport: true, storagePath: "secret", checksum: "secret" }]}
      onChanged={onChanged}
    />,
  );

  expect(screen.getByRole("heading", { name: "สถานะพาสปอร์ต" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "QR พาสปอร์ต" })).toBeTruthy();
  expect(screen.getByText("ยังไม่เผยแพร่")).toBeTruthy();
  expect(screen.queryByText("secret")).toBeNull();

  fireEvent.click(screen.getByRole("button", { name: "เผยแพร่พาสปอร์ต" }));
  await waitFor(() => {
    expect(mocks.invoke).toHaveBeenCalledWith("setPassportStatus", {
      birdId: "b1",
      passportStatus: "published",
    });
  });
  expect((await screen.findByRole("alert")).textContent).toBe("บันทึกสำเร็จ");
  expect(onChanged).toHaveBeenCalled();
  await waitFor(() => {
    expect((screen.getByRole("button", { name: "หมุน Token ใหม่" }) as HTMLButtonElement).disabled).toBe(false);
  });

  fireEvent.click(screen.getByRole("button", { name: "หมุน Token ใหม่" }));
  fireEvent.click(screen.getByRole("button", { name: "ยกเลิก" }));
  expect(mocks.invoke).not.toHaveBeenCalledWith("rotatePassportToken", expect.anything());

  fireEvent.click(screen.getByRole("button", { name: "หมุน Token ใหม่" }));
  expect(screen.getByText(/Token เดิม/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "ยืนยันหมุน Token" }));
  await waitFor(() => {
    expect(mocks.invoke).toHaveBeenCalledWith("rotatePassportToken", { birdId: "b1" });
  });
  await waitFor(() => {
    expect((screen.getByRole("button", { name: "แสดงใน Passport" }) as HTMLButtonElement).disabled).toBe(false);
  });

  fireEvent.click(screen.getByRole("button", { name: "แสดงใน Passport" }));
  await waitFor(() => {
    expect(mocks.invoke).toHaveBeenCalledWith(
      "setPassportPublication",
      expect.objectContaining({ targetType: "PHOTO", assetId: "p1" }),
    );
  });
  await waitFor(() => {
    expect((screen.getByRole("button", { name: "ไม่แสดงใน Passport" }) as HTMLButtonElement).disabled).toBe(false);
  });

  fireEvent.click(screen.getByRole("button", { name: "ไม่แสดงใน Passport" }));
  await waitFor(() => {
    expect(mocks.invoke).toHaveBeenCalledWith(
      "setPassportPublication",
      expect.objectContaining({ targetType: "DOCUMENT", assetId: "d1" }),
    );
  });
});

it("keeps Bird Profile Passport controls compact and collapsed without removing public access or management", async () => {
  const { container } = render(
    <PassportAdmin
      compact
      birdId="b1"
      passportStatus="published"
      publicToken="safe-token"
      photos={[{ photoId: "p1", caption: "Portrait", status: "active" }]}
      documents={[{ documentId: "d1", documentType: "DNA", status: "active" }, { documentId: "d2", documentType: "Health", status: "active" }]}
    />,
  );

  const primary = container.querySelector(".passport-compact-primary") as HTMLElement;
  expect(within(primary).getByText("Bird Passport")).toBeTruthy();
  expect(within(primary).getByText("เผยแพร่แล้ว")).toBeTruthy();
  expect(screen.getByRole("link", { name: "เปิด Public Passport" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "คัดลอกลิงก์" })).toBeTruthy();
  expect(await screen.findByAltText("QR สำหรับ Public Passport")).toBeTruthy();
  const details = screen.getByText("จัดการพาสปอร์ต").closest("details") as HTMLDetailsElement;
  const summary = details.querySelector("summary") as HTMLElement;
  expect(summary.textContent).toContain("รูปภาพ 1");
  expect(summary.textContent).toContain("เอกสาร 2");
  expect(details.open).toBe(false);
  expect(container.querySelectorAll(".publication-management-card")).toHaveLength(1);
  expect(container.querySelectorAll(".publication-assets > section")).toHaveLength(2);
});
