import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("./functions", () => ({ invoke: mocks.invoke, thaiError: () => "เกิดข้อผิดพลาด" }));
import { App } from "./App";

const birds = [
  { birdId: "internal-m1", ringId: "SMOKE-PARENT-M-01", displayName: "SMOKE FATHER 01", currentSex: "male", origin: "external", status: "active", mutation: "Green" },
  { birdId: "internal-m2", ringId: "BLUE-M-02", displayName: "Second Father", currentSex: "male", origin: "purchased", status: "active" },
  { birdId: "internal-f1", ringId: "SMOKE-PARENT-F-01", displayName: "SMOKE MOTHER 01", currentSex: "female", origin: "external", status: "active" },
  { birdId: "internal-u1", ringId: "UNKNOWN-01", displayName: "Unknown Bird", currentSex: "unknown", origin: "external", status: "active" },
  { birdId: "internal-none", ringId: "NO-SEX-01", displayName: "No Evidence", origin: "external", status: "active" },
];
const invoke = async (name: string) => {
  if (name === "listBirds") return birds;
  if (name.startsWith("list")) return [];
  if (name === "getDashboardSummary") return {};
  return {};
};
beforeEach(() => mocks.invoke.mockImplementation(invoke));
afterEach(() => { cleanup(); mocks.invoke.mockReset(); });
const open = async () => { render(<App />); fireEvent.click(await screen.findByRole("button", { name: "Breeding" })); fireEvent.click(screen.getByRole("button", { name: "สร้างคู่" })); return screen.getByRole("heading", { name: "สร้างคู่" }).closest("form")!; };
const results = (form: HTMLElement, role: "พ่อนก" | "แม่นก") => within(within(form).getByRole("listbox", { name: `ผลการค้นหา${role}` }));
const choose = (form: HTMLElement, role: "พ่อนก" | "แม่นก", query: string, name: RegExp) => { fireEvent.change(within(form).getByRole("textbox", { name: `ค้นหา${role}` }), { target: { value: query } }); fireEvent.click(results(form, role).getByRole("option", { name })); };

it("searches father by Ring ID/name case-insensitively and filters authoritative Sex", async () => {
  const form = await open(); const search = within(form).getByRole("textbox", { name: "ค้นหาพ่อนก" });
  fireEvent.change(search, { target: { value: "m-01" } }); const fatherOption=results(form, "พ่อนก").getByRole("option", { name: /SMOKE FATHER 01/ }); expect(fatherOption).toBeTruthy(); expect(fatherOption.textContent).toContain("Green"); expect(fatherOption.textContent).toContain("External"); expect(fatherOption.textContent).not.toContain("Male");
  fireEvent.change(search, { target: { value: "second father" } }); expect(results(form, "พ่อนก").getByRole("option", { name: /BLUE-M-02/ })).toBeTruthy();
  expect(results(form, "พ่อนก").queryByRole("option", { name: /SMOKE MOTHER|Unknown Bird|No Evidence/ })).toBeNull();
});

it("searches mother by Ring ID and excludes male, unknown, and no-evidence Birds", async () => {
  const form = await open(); const search = within(form).getByRole("textbox", { name: "ค้นหาแม่นก" });
  fireEvent.change(search, { target: { value: "smoke-parent-f" } }); expect(results(form, "แม่นก").getByRole("option", { name: /SMOKE MOTHER 01/ })).toBeTruthy();
  expect(results(form, "แม่นก").queryByRole("option", { name: /SMOKE FATHER|Unknown Bird|No Evidence/ })).toBeNull();
});

it("keeps IDs internal, preserves the other parent/date when changing, and submits canonical payload", async () => {
  const form = await open(); choose(form, "พ่อนก", "SMOKE FATHER", /SMOKE FATHER 01/); choose(form, "แม่นก", "F-01", /SMOKE MOTHER 01/); const selectedFather=within(form).getByLabelText("เลือกพ่อนกแล้ว"); expect(selectedFather.textContent).toContain("Mutation: Green"); expect(selectedFather.textContent).toContain("Origin: External"); expect(selectedFather.textContent).not.toContain("Male");
  expect(form.textContent).not.toContain("internal-m1"); expect(form.textContent).not.toContain("internal-f1");
  const date = within(form).getByRole("textbox", { name: "วันเริ่ม" }) as HTMLInputElement; fireEvent.change(date, { target: { value: "14082026" } }); expect(date.value).toBe("14/08/2026");
  fireEvent.click(within(form).getAllByRole("button", { name: "เปลี่ยน" })[0]);
  expect(within(form).getByText("SMOKE MOTHER 01")).toBeTruthy(); expect(date.value).toBe("14/08/2026");
  choose(form, "พ่อนก", "m-01", /SMOKE FATHER 01/); fireEvent.submit(form);
  await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith("createPair", { maleBirdId: "internal-m1", femaleBirdId: "internal-f1", startedOn: "2026-08-14" }));
  expect(within(form).getByRole("status").textContent).toBe("บันทึกสำเร็จ"); expect(within(form).getByRole("textbox",{name:"ค้นหาพ่อนก"})).toBeTruthy(); expect(within(form).getByRole("textbox",{name:"ค้นหาแม่นก"})).toBeTruthy(); expect(date.value).toBe("");
});

it("preserves both parents and date when createPair fails", async () => {
  mocks.invoke.mockImplementation(async(name:string)=>{if(name==="createPair")throw new Error("failed");return invoke(name);});
  const form=await open(); choose(form,"พ่อนก","M-01",/SMOKE FATHER 01/); choose(form,"แม่นก","F-01",/SMOKE MOTHER 01/); const date=within(form).getByRole("textbox",{name:"วันเริ่ม"}) as HTMLInputElement; fireEvent.change(date,{target:{value:"14082026"}}); fireEvent.submit(form); expect(await within(form).findByText("เกิดข้อผิดพลาด")).toBeTruthy(); expect(within(form).getByText("SMOKE FATHER 01")).toBeTruthy(); expect(within(form).getByText("SMOKE MOTHER 01")).toBeTruthy(); expect(date.value).toBe("14/08/2026");
});

it("prevents the same canonical Bird from appearing in the other selector", async () => {
  mocks.invoke.mockImplementation(async (name: string) => name === "listBirds" ? [...birds, { ...birds[0], currentSex: "female" }] : invoke(name));
  const form = await open(); choose(form, "พ่อนก", "M-01", /SMOKE FATHER 01/); fireEvent.change(within(form).getByRole("textbox", { name: "ค้นหาแม่นก" }), { target: { value: "M-01" } });
  expect(within(form).queryByRole("listbox", { name: "ผลการค้นหาแม่นก" })).toBeNull(); expect(within(form).getByText("ไม่พบนกที่ตรงกับการค้นหา")).toBeTruthy();
});
