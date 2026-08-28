import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({invoke:vi.fn()}));
vi.mock("./functions",()=>({invoke:mocks.invoke,thaiError:()=>"เกิดข้อผิดพลาด"}));
import { App } from "./App";

const members=[{role:"male",birdId:"male-uuid",displayName:"Father",ringId:"M-01",sex:"male"},{role:"female",birdId:"female-uuid",displayName:"Mother",ringId:"F-01",sex:"female"}];
const assignment={cageId:"cage-uuid",code:"CAGE-01",name:"Main Cage",status:"active",startsOn:"2026-08-13",endsOn:null};
let cycles:Record<string,unknown>[]=[];
const pair=()=>({pairId:"pair-uuid",status:"active",startedOn:"2026-08-12",members,assignments:[assignment],cycles});
const baseInvoke=async(name:string,payload?:Record<string,unknown>)=>{
  if(name==="listPairs")return[pair()]; if(name==="listCages")return[assignment]; if(name==="listBirds")return[]; if(name.startsWith("list"))return[]; if(name==="getDashboardSummary")return{}; if(name==="getPairDetails")return pair();
  if(name==="createBreedingCycle"){cycles=[{breedingCycleId:"cycle-uuid",startedOn:payload?.startedOn,status:"active",eggs:[]}];return{breedingCycleId:"cycle-uuid"};}
  if(name==="createEgg"){cycles=[{...cycles[0],eggs:[{eggId:"egg-uuid",sequenceNo:payload?.sequenceNo,laidOn:payload?.laidOn,status:"laid"}]}];return{eggId:"egg-uuid"};}
  if(name==="createBirdFromEgg"){const eggs=cycles[0].eggs as Record<string,unknown>[];cycles=[{...cycles[0],eggs:eggs.map(egg=>({...egg,status:"hatched"}))}];return{birdId:"bird-uuid",ringId:payload?.ringId};}
  return{};
};
beforeEach(()=>{cycles=[];mocks.invoke.mockImplementation(baseInvoke);});
afterEach(()=>{cleanup();mocks.invoke.mockReset();});
const open=async()=>{render(<App/>);fireEvent.click(await screen.findByRole("button",{name:"Breeding"}));fireEvent.click(await screen.findByRole("button",{name:/Father.*M-01/}));return(await screen.findByRole("heading",{name:/คู่.*รายละเอียด/})).closest("section")!;};

it("creates a cycle and egg from authoritative Pair context without exposing UUID inputs",async()=>{
  const detail=await open(); expect(detail.textContent).not.toContain("pair-uuid"); expect(within(detail).queryByLabelText(/Pair ID/i)).toBeNull();
  const cycleForm=within(detail).getByRole("heading",{name:"สร้างรอบเพาะ"}).closest("form")!;
  expect(cycleForm.textContent).toContain("Father"); expect(cycleForm.textContent).toContain("M-01"); expect(cycleForm.textContent).toContain("Mother"); expect(cycleForm.textContent).toContain("F-01"); expect(cycleForm.textContent).toContain("CAGE-01 / Main Cage");
  const cycleDate=within(cycleForm).getByRole("textbox",{name:"วันเริ่มรอบเพาะ"}) as HTMLInputElement; fireEvent.change(cycleDate,{target:{value:"14082026"}}); expect(cycleDate.value).toBe("14/08/2026"); fireEvent.submit(cycleForm);
  await waitFor(()=>expect(mocks.invoke).toHaveBeenCalledWith("createBreedingCycle",{pairId:"pair-uuid",startedOn:"2026-08-14"})); expect(await within(detail).findByText("สร้างรอบเพาะสำเร็จ")).toBeTruthy(); expect(cycleDate.value).toBe("");
  const selected=within(detail).getByRole("heading",{name:"รอบเพาะที่เลือก"}).closest("section")!; expect(selected.textContent).toContain("เริ่ม: 14/08/2026"); expect(selected.textContent).toContain("สถานะ: Active"); expect(selected.textContent).not.toContain("cycle-uuid");
  const eggForm=within(selected).getByRole("heading",{name:"เพิ่มไข่"}).closest("form")!; expect(within(eggForm).queryByLabelText(/Cycle ID/i)).toBeNull(); expect(eggForm.textContent).toContain("ลำดับ: 1"); const eggDate=within(eggForm).getByRole("textbox",{name:"วันที่ไข่"}) as HTMLInputElement; fireEvent.change(eggDate,{target:{value:"15082026"}}); expect(eggDate.value).toBe("15/08/2026"); fireEvent.submit(eggForm);
  await waitFor(()=>expect(mocks.invoke).toHaveBeenCalledWith("createEgg",{cycleId:"cycle-uuid",sequenceNo:1,laidOn:"2026-08-15"})); expect(await within(detail).findByText("เพิ่มไข่สำเร็จ")).toBeTruthy(); expect(eggDate.value).toBe(""); expect(within(detail).getByText(/ไข่ลำดับ 1.*15\/08\/2026.*Laid/)).toBeTruthy(); expect(within(detail).getByText("ลำดับ: 2")).toBeTruthy(); expect(detail.textContent).not.toContain("egg-uuid"); expect(mocks.invoke.mock.calls.filter(([name])=>name==="getPairDetails")).toHaveLength(3);
});

it("preserves Cycle and Egg dates and avoids false readback on failure",async()=>{
  cycles=[{breedingCycleId:"cycle-uuid",startedOn:"2026-08-14",status:"active",eggs:[]}]; mocks.invoke.mockImplementation(async(name:string,payload?:Record<string,unknown>)=>{if(name==="createBreedingCycle"||name==="createEgg")throw new Error("failed");return baseInvoke(name,payload);});
  const detail=await open(); const cycleForm=within(detail).getByRole("heading",{name:"สร้างรอบเพาะ"}).closest("form")!; const cycleDate=within(cycleForm).getByRole("textbox",{name:"วันเริ่มรอบเพาะ"}) as HTMLInputElement; fireEvent.change(cycleDate,{target:{value:"16082026"}}); fireEvent.submit(cycleForm); expect(await within(cycleForm).findByText("เกิดข้อผิดพลาด")).toBeTruthy(); expect(cycleDate.value).toBe("16/08/2026");
  fireEvent.click(within(detail).getByRole("button",{name:/รอบเพาะ.*14\/08\/2026.*Active.*ไข่: 0/})); const eggForm=within(detail).getByRole("heading",{name:"เพิ่มไข่"}).closest("form")!; const eggDate=within(eggForm).getByRole("textbox",{name:"วันที่ไข่"}) as HTMLInputElement; fireEvent.change(eggDate,{target:{value:"17082026"}}); fireEvent.submit(eggForm); expect(await within(eggForm).findByText("เกิดข้อผิดพลาด")).toBeTruthy(); expect(eggDate.value).toBe("17/08/2026"); expect(within(detail).getAllByText((_,element)=>element?.textContent==="ไข่: 0").length).toBeGreaterThan(0); expect(mocks.invoke.mock.calls.filter(([name])=>name==="getPairDetails")).toHaveLength(1);
});

it("opens Egg Detail from the selected Cycle and hatches through the trusted contextual operation",async()=>{
  cycles=[{breedingCycleId:"cycle-uuid",startedOn:"2026-08-14",status:"active",eggs:[{eggId:"egg-uuid",sequenceNo:1,laidOn:"2026-08-15",status:"laid"}]}];
  const detail=await open(); fireEvent.click(within(detail).getByRole("button",{name:/รอบเพาะ.*14\/08\/2026.*Active.*ไข่: 1/})); fireEvent.click(within(detail).getByRole("button",{name:/ไข่ลำดับ 1.*15\/08\/2026.*Laid/}));
  const eggDetail=within(detail).getByRole("heading",{name:"Egg Detail"}).closest("section")!; expect(eggDetail.textContent).toContain("ลำดับไข่: 1"); expect(eggDetail.textContent).toContain("วันที่ไข่: 15/08/2026"); expect(eggDetail.textContent).toContain("Status: Laid"); expect(eggDetail.textContent).toContain("รอบเพาะ: 14/08/2026 · Active"); expect(eggDetail.textContent).toContain("พ่อ: Father · Ring ID: M-01"); expect(eggDetail.textContent).toContain("แม่: Mother · Ring ID: F-01"); expect(eggDetail.textContent).toContain("กรง: CAGE-01 / Main Cage"); expect(eggDetail.textContent).not.toContain("egg-uuid"); expect(within(eggDetail).queryByLabelText(/Egg ID/i)).toBeNull();
  const form=within(eggDetail).getByRole("heading",{name:"บันทึกการฟักและสร้างนก"}).closest("form")!; fireEvent.change(within(form).getByRole("textbox",{name:"Ring ID ของลูกนก"}),{target:{value:"CHICK-01"}}); fireEvent.change(within(form).getByRole("textbox",{name:"ชื่อลูกนก"}),{target:{value:"Junior"}}); fireEvent.change(within(form).getByRole("textbox",{name:"Mutation ของลูกนก"}),{target:{value:"Green"}}); const date=within(form).getByRole("textbox",{name:"วันฟัก"}) as HTMLInputElement; fireEvent.change(date,{target:{value:"16082026"}}); expect(date.value).toBe("16/08/2026"); fireEvent.submit(form);
  await waitFor(()=>expect(mocks.invoke).toHaveBeenCalledWith("createBirdFromEgg",{eggId:"egg-uuid",ringId:"CHICK-01",displayName:"Junior",origin:"farm_hatched",mutation:"Green",hatchedOn:"2026-08-16"})); expect(await within(detail).findByText("Status: Hatched")).toBeTruthy(); expect(within(detail).getByText("ไข่ฟักแล้ว")).toBeTruthy(); expect(detail.textContent).not.toContain("egg-uuid"); expect(mocks.invoke.mock.calls.filter(([name])=>name==="getPairDetails")).toHaveLength(2);
});

it("preserves hatch input and canonical Egg state when the trusted operation fails",async()=>{
  cycles=[{breedingCycleId:"cycle-uuid",startedOn:"2026-08-14",status:"active",eggs:[{eggId:"egg-uuid",sequenceNo:1,laidOn:"2026-08-15",status:"laid"}]}]; mocks.invoke.mockImplementation(async(name:string,payload?:Record<string,unknown>)=>{if(name==="createBirdFromEgg")throw new Error("failed");return baseInvoke(name,payload);});
  const detail=await open(); fireEvent.click(within(detail).getByRole("button",{name:/รอบเพาะ.*ไข่: 1/})); fireEvent.click(within(detail).getByRole("button",{name:/ไข่ลำดับ 1/})); const form=within(detail).getByRole("heading",{name:"บันทึกการฟักและสร้างนก"}).closest("form")!; const ring=within(form).getByRole("textbox",{name:"Ring ID ของลูกนก"}) as HTMLInputElement; const name=within(form).getByRole("textbox",{name:"ชื่อลูกนก"}) as HTMLInputElement; const date=within(form).getByRole("textbox",{name:"วันฟัก"}) as HTMLInputElement; fireEvent.change(ring,{target:{value:"CHICK-02"}}); fireEvent.change(name,{target:{value:"Retry"}}); fireEvent.change(date,{target:{value:"17082026"}}); fireEvent.submit(form);
  expect(await within(form).findByText("เกิดข้อผิดพลาด")).toBeTruthy(); expect(ring.value).toBe("CHICK-02"); expect(name.value).toBe("Retry"); expect(date.value).toBe("17/08/2026"); expect(within(detail).getByText("Status: Laid")).toBeTruthy(); expect(mocks.invoke.mock.calls.filter(([operation])=>operation==="getPairDetails")).toHaveLength(1);
});
