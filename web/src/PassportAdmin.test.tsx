import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

  expect(screen.getByText("PUBLICATION STATUS")).toBeTruthy();
  expect(screen.getByText("draft")).toBeTruthy();
  expect(screen.getByText("แบบร่าง")).toBeTruthy();
  expect(screen.queryByText("secret")).toBeNull();

  fireEvent.click(screen.getByRole("button", { name: "เผยแพร่ Passport" }));
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
