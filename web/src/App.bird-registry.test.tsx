import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({invoke:vi.fn()}));
vi.mock("./functions",()=>({invoke:mocks.invoke,thaiError:()=>"เกิดข้อผิดพลาด"}));
import { App } from "./App";

afterEach(()=>{cleanup();mocks.invoke.mockReset();});

it("refetches authoritative Birds once on entry and renders external and farm-hatched identities without UUIDs",async()=>{
  let birdReads=0;
  mocks.invoke.mockImplementation(async(name:string)=>{
    if(name==="listBirds"){birdReads+=1;return birdReads===1?[{birdId:"parent-uuid",ringId:"SMOKE-PARENT-M-01",displayName:"SMOKE FATHER 01",mutation:"Normal",origin:"external",status:"active"}]:[{birdId:"parent-uuid",ringId:"SMOKE-PARENT-M-01",displayName:"SMOKE FATHER 01",mutation:"Normal",origin:"external",status:"active"},{birdId:"chick-uuid",ringId:"SMOKE-CHICK-01",displayName:"SMOKE CHICK 01",mutation:"Normal",origin:"farm_hatched",status:"active"}];}
    if(name==="getDashboardSummary")return{}; if(name.startsWith("list"))return[]; return{};
  });
  render(<App/>); await waitFor(()=>expect(birdReads).toBe(1)); fireEvent.click(screen.getByRole("button",{name:"Birds"}));
  const chick=await screen.findByRole("button",{name:/Ring ID: SMOKE-CHICK-01.*Display Name: SMOKE CHICK 01.*Mutation: Normal.*Origin: Farm Hatched.*Status: Active/}); expect(chick.textContent).not.toContain("chick-uuid");
  expect(screen.getByText("FLOCK INDEX")).toBeTruthy(); expect(screen.getByText("Bird identities")).toBeTruthy();
  expect(within(chick).getByText("Ring ID").tagName).toBe("SMALL"); expect(within(chick).getByText("SMOKE-CHICK-01").tagName).toBe("STRONG");
  const external=screen.getByRole("button",{name:/Ring ID: SMOKE-PARENT-M-01.*Origin: External.*Status: Active/}); expect(external.textContent).not.toContain("parent-uuid"); await waitFor(()=>expect(birdReads).toBe(2));
});

it("labels the Ring ID availability action as ตรวจสอบ and keeps the trusted callable unchanged",async()=>{
  mocks.invoke.mockImplementation(async(name:string)=>name==="getDashboardSummary"?{}:name.startsWith("list")?[]:{});
  render(<App/>); fireEvent.click(await screen.findByRole("button",{name:"Birds"})); const form=screen.getByRole("heading",{name:"ตรวจสอบ Ring ID"}).closest("form")!; const action=within(form).getByRole("button",{name:"ตรวจสอบ"}); expect(within(form).queryByRole("button",{name:"บันทึก"})).toBeNull(); fireEvent.change(within(form).getByRole("textbox",{name:"Ring ID *"}),{target:{value:"SMOKE-CHICK-01"}}); fireEvent.click(action); await waitFor(()=>expect(mocks.invoke).toHaveBeenCalledWith("checkRingIdAvailability",{ringId:"SMOKE-CHICK-01"})); expect(await within(form).findByText("ตรวจสอบสำเร็จ")).toBeTruthy();
});
