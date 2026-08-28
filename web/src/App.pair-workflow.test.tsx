import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({invoke:vi.fn()}));
vi.mock("./functions",()=>({invoke:mocks.invoke,thaiError:()=>"เกิดข้อผิดพลาด"}));
import { App } from "./App";

const members=[{role:"male",birdId:"male-uuid",displayName:"SMOKE FATHER 01",ringId:"SMOKE-PARENT-M-01",sex:"male"},{role:"female",birdId:"female-uuid",displayName:"SMOKE MOTHER 01",ringId:"SMOKE-PARENT-F-01",sex:"female"}];
const cage={cageId:"cage-uuid",code:"SMOKE-CAGE-01",name:"Smoke Cage",status:"active"};
let status="draft",assigned=false;
const pair=()=>({pairId:"pair-uuid",status,startedOn:"2026-08-14",members,assignments:assigned?[{cageId:"cage-uuid",code:cage.code,name:cage.name,status:"active",startsOn:"2026-08-15",endsOn:null}]:[]});
const invoke=async(name:string)=>{if(name==="listPairs")return[pair()];if(name==="listCages")return[cage];if(name==="listBirds")return[];if(name.startsWith("list"))return[];if(name==="getDashboardSummary")return{};if(name==="getPairDetails")return pair();if(name==="activatePair"){status="active";return{pairId:"pair-uuid",kinship:{status:"unknown"}};}if(name==="assignPairToCage"){assigned=true;return{cageAssignmentId:"assignment-uuid"};}return{};};
beforeEach(()=>{status="draft";assigned=false;mocks.invoke.mockImplementation(invoke);});
afterEach(()=>{cleanup();mocks.invoke.mockReset();});
const open=async()=>{render(<App/>);fireEvent.click(await screen.findByRole("button",{name:"Breeding"}));fireEvent.click(await screen.findByRole("button",{name:/พ่อนก: SMOKE FATHER 01/}));return (await screen.findByRole("heading",{name:"คู่ — รายละเอียด"})).closest("section")!;};

it("follows activate then assign ordering with internal IDs and authoritative readback",async()=>{
  const detail=await open(); expect(within(detail).queryByRole("heading",{name:"จัดคู่เข้ากรง"})).toBeNull(); expect(detail.textContent).not.toContain("pair-uuid"); expect(detail.textContent).not.toContain("male-uuid");
  const activation=within(detail).getByRole("heading",{name:"เปิดใช้งานคู่"}).closest("form")!; fireEvent.change(within(activation).getByRole("textbox",{name:"วันที่เปิดใช้งาน"}),{target:{value:"15082026"}}); fireEvent.submit(activation);
  await waitFor(()=>expect(mocks.invoke).toHaveBeenCalledWith("activatePair",{pairId:"pair-uuid",activeOn:"2026-08-15"})); expect(await within(detail).findByText("สถานะ: Active")).toBeTruthy(); expect(within(detail).getByText("เปิดใช้งานคู่สำเร็จ")).toBeTruthy(); expect(mocks.invoke.mock.calls.filter(([name])=>name==="getPairDetails")).toHaveLength(2);
  const assignment=within(detail).getByRole("heading",{name:"จัดคู่เข้ากรง"}).closest("form")!; expect(within(assignment).queryByRole("textbox",{name:/Cage ID/i})).toBeNull(); fireEvent.change(within(assignment).getByRole("textbox",{name:"ค้นหากรง"}),{target:{value:"smoke-cage"}}); fireEvent.click(within(assignment).getByRole("option",{name:/Smoke Cage.*SMOKE-CAGE-01.*Active/})); fireEvent.change(within(assignment).getByRole("textbox",{name:"วันเริ่มจัดกรง"}),{target:{value:"15082026"}}); fireEvent.submit(assignment);
  await waitFor(()=>expect(mocks.invoke).toHaveBeenCalledWith("assignPairToCage",{pairId:"pair-uuid",cageId:"cage-uuid",startsOn:"2026-08-15"})); const cageCard=within(detail).getByRole("heading",{name:"กรงปัจจุบัน"}).closest("section")!; expect(cageCard.textContent).toContain("Smoke Cage"); expect(cageCard.textContent).toContain("SMOKE-CAGE-01"); expect(cageCard.textContent).toContain("15/08/2026"); expect(within(detail).getByText("จัดคู่เข้ากรงสำเร็จ")).toBeTruthy(); expect(mocks.invoke.mock.calls.filter(([name])=>name==="getPairDetails")).toHaveLength(3);
});

it("preserves cage selection and date and shows no optimistic assignment on failure",async()=>{
  status="active";mocks.invoke.mockImplementation(async(name:string)=>{if(name==="assignPairToCage")throw new Error("failed");return invoke(name);}); const detail=await open(); const form=within(detail).getByRole("heading",{name:"จัดคู่เข้ากรง"}).closest("form")!; fireEvent.change(within(form).getByRole("textbox",{name:"ค้นหากรง"}),{target:{value:"Smoke"}}); fireEvent.click(within(form).getByRole("option",{name:/Smoke Cage/})); const date=within(form).getByRole("textbox",{name:"วันเริ่มจัดกรง"}) as HTMLInputElement; fireEvent.change(date,{target:{value:"15082026"}}); fireEvent.submit(form); expect(await within(form).findByText("เกิดข้อผิดพลาด")).toBeTruthy(); expect(within(form).getByText("Smoke Cage")).toBeTruthy(); expect(date.value).toBe("15/08/2026"); expect(within(detail).getByText("ยังไม่ได้จัดเข้ากรง")).toBeTruthy(); expect(mocks.invoke.mock.calls.filter(([name])=>name==="getPairDetails")).toHaveLength(1);
});
