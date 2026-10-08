import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ invoke: vi.fn(), ref: vi.fn((_storage, path: string) => ({ path })), uploadBytes: vi.fn() }));
vi.mock("./functions", () => ({ invoke: mocks.invoke, thaiError: () => "เกิดข้อผิดพลาด" }));
vi.mock("./firebase", () => ({ storage: {} }));
vi.mock("firebase/storage", () => ({ ref: mocks.ref, uploadBytes: mocks.uploadBytes }));
import { BirdAssets } from "./BirdAssets";

afterEach(() => { cleanup(); vi.clearAllMocks(); });

const fileInput = (form: HTMLElement) => within(form).getByLabelText(/ไฟล์/) as HTMLInputElement;

it("uploads and finalizes an approved Bird photo before authoritative refresh", async () => {
  const refresh = vi.fn(async () => undefined);
  mocks.invoke.mockImplementation(async (name: string) => name === "beginBirdAssetIntake" ? { storagePath: "bird-assets/b1/photos/intake/asset.jpg" } : { photoId: "photo-1" });
  mocks.uploadBytes.mockResolvedValue({});
  render(<BirdAssets birdId="b1" photos={[]} documents={[]} onSaved={refresh}/>);
  const form = screen.getByRole("heading", { name: "เพิ่มรูปภาพ" }).closest("form")!;
  fireEvent.change(fileInput(form), { target: { files: [new File([new Uint8Array([1, 2, 3])], "bird.jpg", { type: "image/jpeg" })] } });
  fireEvent.submit(form);
  expect(await within(form).findByText("บันทึกไฟล์สำเร็จ")).toBeTruthy();
  expect(mocks.invoke.mock.calls.map(([name]) => name)).toEqual(["beginBirdAssetIntake", "finalizeBirdAssetIntake"]);
  expect(mocks.uploadBytes).toHaveBeenCalledOnce(); expect(refresh).toHaveBeenCalledOnce();
});

it("uploads and finalizes an approved Bird document", async () => {
  const refresh = vi.fn(async () => undefined);
  mocks.invoke.mockImplementation(async (name: string) => name === "beginBirdAssetIntake" ? { storagePath: "bird-assets/b1/documents/intake/asset.pdf" } : { documentId: "document-1" });
  mocks.uploadBytes.mockResolvedValue({});
  render(<BirdAssets birdId="b1" photos={[]} documents={[]} onSaved={refresh}/>);
  const form = screen.getByRole("heading", { name: "เพิ่มเอกสาร" }).closest("form")!;
  fireEvent.change(fileInput(form), { target: { files: [new File([new Uint8Array([37, 80, 68, 70])], "dna.pdf", { type: "application/pdf" })] } });
  fireEvent.change(within(form).getByLabelText(/ประเภทเอกสาร/), { target: { value: "DNA" } });
  fireEvent.change(within(form).getByRole("textbox", { name: "วันที่ออกเอกสาร" }), { target: { value: "01092026" } });
  fireEvent.submit(form);
  expect(await within(form).findByText("บันทึกไฟล์สำเร็จ")).toBeTruthy();
  expect(mocks.invoke.mock.calls.map(([name]) => name)).toEqual(["beginBirdAssetIntake", "finalizeBirdAssetIntake"]);
  expect(mocks.uploadBytes).toHaveBeenCalledOnce(); expect(refresh).toHaveBeenCalledOnce();
});

it("reports the exact upload stage without exposing raw backend details", async () => {
  mocks.invoke.mockResolvedValue({ storagePath: "bird-assets/b1/photos/intake/asset.jpg" });
  mocks.uploadBytes.mockRejectedValue(new Error("sensitive raw error"));
  render(<BirdAssets birdId="b1" photos={[]} documents={[]} onSaved={vi.fn()}/>);
  const form = screen.getByRole("heading", { name: "เพิ่มรูปภาพ" }).closest("form")!;
  fireEvent.change(fileInput(form), { target: { files: [new File(["jpeg"], "bird.jpg", { type: "image/jpeg" })] } });
  fireEvent.submit(form);
  await waitFor(() => expect(within(form).getByRole("status").textContent).toBe("อัปโหลดไฟล์ไม่สำเร็จ: เกิดข้อผิดพลาด"));
  expect(within(form).getByRole("status").textContent).not.toContain("sensitive");
});

it("groups asset history with Thai statuses and offers archive only for active items",async()=>{
  const refresh=vi.fn(async()=>undefined);mocks.invoke.mockResolvedValue({});
  render(<BirdAssets birdId="b1" photos={[{photoId:"p-active",caption:"หน้าตรง",status:"active",readUrl:"/operator-media/v1/photo"},{photoId:"p-archived",caption:"ภาพเดิม",status:"archived"}]} documents={[{documentId:"d-active",documentType:"DNA",issuedOn:"2026-09-01",status:"active"},{documentId:"d-old",documentType:"ใบสุขภาพเดิม",issuedOn:"2026-08-01",status:"superseded"}]} onSaved={refresh}/>);
  const photoGroup=screen.getByRole("heading",{name:"รูปภาพ",level:6}).closest("section")!;const documentGroup=screen.getByRole("heading",{name:"เอกสาร",level:6}).closest("section")!;
  expect(within(photoGroup).getByAltText("ภาพย่อ หน้าตรง")).toBeTruthy();expect(within(photoGroup).getByText("ใช้งานอยู่")).toBeTruthy();expect(within(photoGroup).getByText("เก็บถาวรแล้ว")).toBeTruthy();
  expect(within(documentGroup).getByText("วันที่ออก 01/09/2026")).toBeTruthy();expect(within(documentGroup).getByText("ถูกแทนที่แล้ว")).toBeTruthy();
  expect(screen.getAllByRole("button",{name:"เก็บถาวร"})).toHaveLength(2);
  expect(within(screen.getByLabelText("รูปภาพ: ภาพเดิม")).queryByRole("button",{name:"เก็บถาวร"})).toBeNull();
  expect(within(screen.getByLabelText("เอกสาร: ใบสุขภาพเดิม")).queryByRole("button",{name:"เก็บถาวร"})).toBeNull();
  fireEvent.click(within(screen.getByLabelText("รูปภาพ: หน้าตรง")).getByRole("button",{name:"เก็บถาวร"}));
  await waitFor(()=>expect(mocks.invoke).toHaveBeenCalledWith("archiveBirdPhoto",{birdId:"b1",photoId:"p-active"}));
  fireEvent.click(within(screen.getByLabelText("เอกสาร: DNA")).getByRole("button",{name:"เก็บถาวร"}));
  await waitFor(()=>expect(mocks.invoke).toHaveBeenCalledWith("archiveBirdDocument",{birdId:"b1",documentId:"d-active"}));
  expect(refresh).toHaveBeenCalledTimes(2);
});
