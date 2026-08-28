import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("./functions", () => ({ invoke: mocks.invoke, thaiError: () => "เกิดข้อผิดพลาด" }));
import { App } from "./App";

const birdDetail = (sexHistory: Array<Record<string, unknown>> = [], weightHistory: Array<Record<string, unknown>> = []) => ({ birdId: "b1", ringId: "GC-001", displayName: "Bird", status: "active", parentage: { male: { ringId: "M-1" }, female: { ringId: "F-1" } }, sexHistory, weightHistory, photos: [], documents: [] });
const defaultInvoke = async (name: string) => {
  if (name === "listBirds") return [{ birdId: "b1", ringId: "GC-001", displayName: "Bird" }];
  if (name === "listPairs") return [{ pairId: "p1", status: "draft", startedOn: "2026-08-14", members: [{ role: "male", birdId: "b1", displayName: "Father", ringId: "M-1", sex: "male" }, { role: "female", birdId: "b2", displayName: "Mother", ringId: "F-1", sex: "female" }] }];
  if (name === "listCages") return [{ cageId: "cage-uuid", code: "CAGE-01", name: "Main Cage", status: "active" }];
  if (name === "listCustomers") return [{ customerId: "c1", displayName: "Customer" }];
  if (name.startsWith("list")) return [];
  if (name === "getDashboardSummary") return {};
  if (name === "getBirdDetails") return birdDetail();
  if (name === "getPairDetails") return { pairId: "p1", status: "draft", startedOn: "2026-08-14", members: [{ role: "male", birdId: "b1", displayName: "Father", ringId: "M-1", sex: "male" }, { role: "female", birdId: "b2", displayName: "Mother", ringId: "F-1", sex: "female" }], assignments: [] };
  if (name === "getCustomerDetails") return { customerId: "c1", displayName: "Customer", phone: "1", sales: [], reservations: [] };
  return {};
};
beforeEach(() => mocks.invoke.mockImplementation(defaultInvoke));
afterEach(() => { cleanup(); mocks.invoke.mockReset(); });
const openBird = async () => { render(<App />); fireEvent.click(await screen.findByRole("button", { name: "Birds" })); fireEvent.click(await screen.findByRole("button", { name: /Ring ID: GC-001/ })); return (await screen.findByRole("heading", { name: "บันทึกเพศ" })).closest("form")!; };
const fill = (form: HTMLElement, method: string) => { const selects=within(form).getAllByRole("combobox"); fireEvent.change(selects[0],{target:{value:"female"}}); fireEvent.change(selects[1],{target:{value:method}}); fireEvent.change(within(form).getByRole("textbox",{name:"วันที่"}),{target:{value:"13082026"}}); };

it("opens Bird Detail without exposing its internal ID in the registry", async () => { render(<App />); fireEvent.click(await screen.findByRole("button", { name: "Birds" })); const row=await screen.findByRole("button", { name: /Ring ID: GC-001/ }); expect(row.textContent).not.toContain("b1"); fireEvent.click(row); expect(await screen.findByText("พ่อแม่: M-1 / F-1")).toBeTruthy(); });

it("shows only canonical method labels and values", async () => {
  const form=await openBird(); const [sex, method]=within(form).getAllByRole("combobox");
  expect(within(sex).getAllByRole("option").map(x=>[x.textContent,x.getAttribute("value")])).toEqual([["เลือก",""],["Male","male"],["Female","female"],["Unknown","unknown"]]);
  expect(within(method).getAllByRole("option").map(x=>[x.textContent,x.getAttribute("value")])).toEqual([["เลือก",""],["DNA","dna"],["Sex Linked","sex_linked"],["Visual","visual"],["Unknown","unknown"]]);
  expect(within(method).queryByRole("option",{name:/vet/i})).toBeNull(); expect(within(form).queryByRole("textbox",{name:/Bird ID/})).toBeNull();
});

it.each([["DNA","dna"],["Sex Linked","sex_linked"],["Visual","visual"],["Unknown","unknown"]])("submits %s as canonical %s", async (_label, canonical) => {
  const form=await openBird(); fill(form,canonical); fireEvent.submit(form);
  await waitFor(()=>expect(mocks.invoke).toHaveBeenCalledWith("recordSexHistory",{birdId:"b1",sex:"female",method:canonical,determinedOn:"2026-08-13"}));
});

it("refreshes authoritative Bird Detail after success while preserving success and reset state", async () => {
  let saved=false;
  mocks.invoke.mockImplementation(async (name:string) => { if(name==="recordSexHistory"){saved=true;return{sexHistoryId:"h1"};} if(name==="getBirdDetails")return birdDetail(saved?[{sex:"female",method:"sex_linked",determinedOn:"2026-08-13"}]:[]); return defaultInvoke(name); });
  const form=await openBird(); expect(await screen.findByText("ประวัติเพศ: 0")).toBeTruthy(); fill(form,"sex_linked"); fireEvent.submit(form);
  expect(await screen.findByText("ประวัติเพศ: 1")).toBeTruthy(); const sexLedger=screen.getByRole("heading",{name:"ประวัติเพศ: 1"}).closest("section")!; expect(sexLedger.textContent).toContain("Female"); expect(sexLedger.textContent).toContain("Sex Linked"); expect(sexLedger.textContent).toContain("13/08/2026"); expect(within(form).getByRole("status").textContent).toBe("บันทึกสำเร็จ");
  const selects=within(form).getAllByRole("combobox") as HTMLSelectElement[]; expect(selects[0].value).toBe(""); expect(selects[1].value).toBe(""); expect((within(form).getByRole("textbox",{name:"วันที่"}) as HTMLInputElement).value).toBe("");
  expect(mocks.invoke.mock.calls.filter(([name])=>name==="getBirdDetails")).toHaveLength(2);
});

it("preserves entered values and does not refresh detail when recordSexHistory fails", async () => {
  mocks.invoke.mockImplementation(async (name:string) => { if(name==="recordSexHistory")throw new Error("failed"); return defaultInvoke(name); });
  const form=await openBird(); fill(form,"visual"); fireEvent.submit(form); expect(await within(form).findByText("เกิดข้อผิดพลาด")).toBeTruthy();
  const selects=within(form).getAllByRole("combobox") as HTMLSelectElement[]; expect(selects[0].value).toBe("female"); expect(selects[1].value).toBe("visual"); expect((within(form).getByRole("textbox",{name:"วันที่"}) as HTMLInputElement).value).toBe("13/08/2026");
  expect(mocks.invoke.mock.calls.filter(([name])=>name==="getBirdDetails")).toHaveLength(1);
});

it("records decimal grams from Bird context and authoritatively presents DD/MM/YYYY history",async()=>{
  let saved=false;
  mocks.invoke.mockImplementation(async(name:string)=>{if(name==="recordWeightHistory"){saved=true;return{weightHistoryId:"weight-uuid"};}if(name==="getBirdDetails")return birdDetail([],saved?[{weightGrams:85.5,measuredOn:"2026-08-14"}]:[]);return defaultInvoke(name);});
  const sexForm=await openBird(); const detail=sexForm.closest(".bird-profile") as HTMLElement; const form=within(detail).getByRole("heading",{name:"บันทึกน้ำหนัก"}).closest("form")!; expect(form.textContent).toContain("นก: Bird"); expect(form.textContent).toContain("Ring ID: GC-001"); expect(within(form).queryByText(/Bird ID/)).toBeNull(); expect(within(form).queryByLabelText(/Bird ID/)).toBeNull(); expect(within(form).getByText("น้ำหนัก (กรัม) *")).toBeTruthy();
  const weight=within(form).getByRole("spinbutton",{name:"น้ำหนัก \(กรัม\)"}) as HTMLInputElement; const date=within(form).getByRole("textbox",{name:"วันที่บันทึกน้ำหนัก"}) as HTMLInputElement; expect(within(form).getAllByText("วันที่ *")).toHaveLength(1); fireEvent.change(weight,{target:{value:"85.5"}}); fireEvent.change(date,{target:{value:"14082026"}}); expect(date.value).toBe("14/08/2026"); fireEvent.submit(form);
  await waitFor(()=>expect(mocks.invoke).toHaveBeenCalledWith("recordWeightHistory",{birdId:"b1",weightGrams:85.5,measuredOn:"2026-08-14"})); expect(await within(detail).findByText("ประวัติน้ำหนัก: 1")).toBeTruthy(); const weightLedger=within(detail).getByRole("heading",{name:"ประวัติน้ำหนัก: 1"}).closest("section")!; expect(weightLedger.textContent).toContain("14/08/2026"); expect(weightLedger.textContent).toContain("85.5 กรัม"); expect(within(form).getByRole("status").textContent).toBe("บันทึกสำเร็จ"); expect(weight.value).toBe(""); expect(date.value).toBe(""); expect(detail.textContent).not.toContain("weight-uuid"); expect(mocks.invoke.mock.calls.filter(([name])=>name==="getBirdDetails")).toHaveLength(2);
});

it("rejects invalid Weight/date locally without invoking the callable",async()=>{
  const sexForm=await openBird(); const form=within(sexForm.closest("section")!).getByRole("heading",{name:"บันทึกน้ำหนัก"}).closest("form")!; const weight=within(form).getByRole("spinbutton",{name:"น้ำหนัก \(กรัม\)"}); const date=within(form).getByRole("textbox",{name:"วันที่บันทึกน้ำหนัก"}); fireEvent.change(weight,{target:{value:"0"}}); fireEvent.change(date,{target:{value:"31022026"}}); fireEvent.submit(form); expect(await within(form).findByText("น้ำหนักต้องเป็นตัวเลขมากกว่าศูนย์")).toBeTruthy(); expect(within(form).getByText("กรุณากรอกวันที่ที่มีอยู่จริง")).toBeTruthy(); expect(mocks.invoke.mock.calls.some(([name])=>name==="recordWeightHistory")).toBe(false);
});

it("preserves Weight/date and canonical readback when recording fails",async()=>{
  mocks.invoke.mockImplementation(async(name:string)=>{if(name==="recordWeightHistory")throw new Error("failed");return defaultInvoke(name);}); const sexForm=await openBird(); const detail=sexForm.closest(".bird-profile") as HTMLElement; const form=within(detail).getByRole("heading",{name:"บันทึกน้ำหนัก"}).closest("form")!; const weight=within(form).getByRole("spinbutton",{name:"น้ำหนัก \(กรัม\)"}) as HTMLInputElement; const date=within(form).getByRole("textbox",{name:"วันที่บันทึกน้ำหนัก"}) as HTMLInputElement; fireEvent.change(weight,{target:{value:"92.25"}}); fireEvent.change(date,{target:{value:"15082026"}}); fireEvent.submit(form); expect(await within(form).findByText("เกิดข้อผิดพลาด")).toBeTruthy(); expect(weight.value).toBe("92.25"); expect(date.value).toBe("15/08/2026"); expect(within(detail).getByText("ประวัติน้ำหนัก: 0")).toBeTruthy(); expect(mocks.invoke.mock.calls.filter(([name])=>name==="getBirdDetails")).toHaveLength(1);
});

it("shows human-readable Pair and Cage registries and Pair Detail without UUIDs or redundant Sex evidence", async () => { render(<App />); fireEvent.click(await screen.findByRole("button", { name: "Breeding" })); const pair=await screen.findByRole("button", { name: /พ่อนก: Father.*Ring ID: M-1.*แม่นก: Mother.*Draft.*14\/08\/2026/ }); expect(pair.textContent).not.toContain("p1"); expect(pair.textContent).not.toContain("2026-08-14"); const cage=screen.getByRole("button",{name:/Code: CAGE-01.*Status: Active/}); expect(cage.textContent).not.toContain("cage-uuid"); fireEvent.click(pair); expect(await screen.findByText("วันเริ่ม: 14/08/2026")).toBeTruthy(); expect(screen.getByText("Ring ID: M-1")).toBeTruthy(); expect(screen.getByText("Ring ID: F-1")).toBeTruthy(); expect(screen.queryByText(/พ่อนก · Sex: Male/)).toBeNull(); expect(screen.queryByText(/แม่นก · Sex: Female/)).toBeNull(); expect(document.body.textContent).not.toContain("p1"); expect(document.body.textContent).not.toContain("b1"); expect(document.body.textContent).not.toContain("b2"); });
it("opens customer detail without exposing its internal ID", async () => { render(<App />); fireEvent.click(await screen.findByRole("button", { name: "Customers" })); const customer=await screen.findByRole("button", { name: /Display Name: Customer/ }); expect(customer.textContent).not.toContain("c1"); fireEvent.click(customer); expect(await screen.findByRole("heading", { name: "Customer" })).toBeTruthy(); expect(document.body.textContent).not.toContain("c1"); });
