import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({invoke:vi.fn()}));
vi.mock("./functions",()=>({invoke:mocks.invoke,thaiError:()=>"เกิดข้อผิดพลาด"}));
import { App } from "./App";

afterEach(()=>{cleanup();mocks.invoke.mockReset();});

it("refetches authoritative Birds once on entry and renders external and farm-hatched identities without UUIDs",async()=>{
  let birdReads=0;
  mocks.invoke.mockImplementation(async(name:string)=>{
    if(name==="listBirds"){birdReads+=1;return birdReads===1?[{birdId:"parent-uuid",ringId:"SMOKE-PARENT-M-01",displayName:"SMOKE FATHER 01",mutation:"Normal",origin:"external",status:"active"}]:[{birdId:"parent-uuid",ringId:"SMOKE-PARENT-M-01",displayName:"SMOKE FATHER 01",mutation:"Normal",origin:"external",status:"active"},{birdId:"chick-uuid",ringId:"SMOKE-CHICK-01",displayName:"SMOKE CHICK 01",mutation:"Normal",origin:"farm_hatched",status:"active"},{birdId:"sold-uuid",ringId:"SMOKE-SOLD-01",displayName:"SMOKE SOLD 01",mutation:"Normal",origin:"external",status:"sold"}];}
    if(name==="getDashboardSummary")return{}; if(name.startsWith("list"))return[]; return{};
  });
  render(<App/>); await waitFor(()=>expect(birdReads).toBe(1)); fireEvent.click(screen.getByRole("button",{name:"Birds"}));
  const chick=await screen.findByRole("button",{name:/Ring ID: SMOKE-CHICK-01.*Display Name: SMOKE CHICK 01.*Mutation: Normal.*Origin: ฟักในฟาร์ม.*Status: อยู่ในฟาร์ม/}); expect(chick.textContent).not.toContain("chick-uuid");
  expect(screen.getByText("FLOCK INDEX")).toBeTruthy(); expect(screen.getByText("Bird identities")).toBeTruthy();
  expect(within(chick).getByText("Ring ID").tagName).toBe("SMALL"); expect(within(chick).getByText("SMOKE-CHICK-01").tagName).toBe("STRONG");
  const external=screen.getByRole("button",{name:/Ring ID: SMOKE-PARENT-M-01.*Origin: รับเข้าจากภายนอก.*Status: อยู่ในฟาร์ม/}); expect(external.textContent).not.toContain("parent-uuid");
  expect(screen.getByRole("button",{name:/Ring ID: SMOKE-SOLD-01.*Status: ขายแล้ว/})).toBeTruthy(); await waitFor(()=>expect(birdReads).toBe(2));
});

it("labels the Ring ID availability action as ตรวจสอบ and keeps the trusted callable unchanged",async()=>{
  mocks.invoke.mockImplementation(async(name:string)=>name==="getDashboardSummary"?{}:name.startsWith("list")?[]:{});
  render(<App/>); fireEvent.click(await screen.findByRole("button",{name:"Birds"})); const form=screen.getByRole("heading",{name:"ตรวจสอบ Ring ID"}).closest("form")!; const action=within(form).getByRole("button",{name:"ตรวจสอบ"}); expect(within(form).queryByRole("button",{name:"บันทึก"})).toBeNull(); fireEvent.change(within(form).getByRole("textbox",{name:"Ring ID *"}),{target:{value:"SMOKE-CHICK-01"}}); fireEvent.click(action); await waitFor(()=>expect(mocks.invoke).toHaveBeenCalledWith("checkRingIdAvailability",{ringId:"SMOKE-CHICK-01"})); expect(await within(form).findByText("ตรวจสอบสำเร็จ")).toBeTruthy();
});

it.each([
  ["TERM-01", "sold", "ขายแล้ว"],
  ["TERM-02", "given_away", "Given Away"],
  ["TERM-03", "deceased", "เสียชีวิต"],
  ["TERM-04", "lost", "Lost"],
])("BIRD-11 %s keeps a %s Bird readable from Registry through Profile",async(_uatId,status,statusLabel)=>{
  const bird={birdId:`terminal-${status}`,ringId:`TERM-${status}`,displayName:`Historical ${status}`,mutation:"Normal",origin:"external",status,hatchedOn:"2024-02-29",passportStatus:"published",sexHistory:[{sex:"female",method:"dna",determinedOn:"2025-01-02"}],weightHistory:[{weightGrams:88,measuredOn:"2025-02-03"}],photos:[],documents:[]};
  mocks.invoke.mockImplementation(async(name:string)=>{
    if(name==="listBirds")return[bird];
    if(name==="getBirdDetails")return bird;
    if(name==="getDashboardSummary")return{};
    if(name.startsWith("list"))return[];
    return{};
  });
  render(<App/>);
  fireEvent.click(await screen.findByRole("button",{name:"Birds"}));
  const row=await screen.findByRole("button",{name:new RegExp(`Ring ID: TERM-${status}.*Status: ${statusLabel}`)});
  expect(row.className).toContain("bird-visual-terminal");
  expect(row.className).not.toContain("bird-visual-current");
  fireEvent.click(row);
  await waitFor(()=>expect(mocks.invoke).toHaveBeenCalledWith("getBirdDetails",{birdId:`terminal-${status}`}));
  const profile=await screen.findByLabelText("ข้อมูลประจำตัวนก");
  expect(profile.className).toContain("bird-visual-terminal");
  expect(profile.className).not.toContain("bird-visual-current");
  expect(screen.getByRole("heading",{name:`Historical ${status}`})).toBeTruthy();
  expect(screen.getAllByText(`TERM-${status}`).length).toBeGreaterThan(0);
  expect(screen.getAllByText(statusLabel).length).toBeGreaterThan(0);
  expect(screen.getByText("88 กรัม · 03/02/2025")).toBeTruthy();
});
