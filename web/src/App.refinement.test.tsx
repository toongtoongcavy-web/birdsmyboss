import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({invoke:vi.fn()}));
vi.mock("./functions",()=>({invoke:mocks.invoke,thaiError:()=>"เกิดข้อผิดพลาด"}));
import { App } from "./App";

const bird={birdId:"bird-internal",ringId:"BMB-01",displayName:"Sunny",mutation:"Lutino",origin:"farm_hatched",currentSex:"male",status:"active"};
const pair={pairId:"pair-internal",status:"active",startedOn:"2026-07-01",members:[{role:"male",displayName:"Sunny",ringId:"BMB-01",sex:"male"},{role:"female",displayName:"Mali",ringId:"BMB-02",sex:"female"}],assignments:[{name:"Garden Aviary",code:"A-01",startsOn:"2026-07-01"}],cycles:[]};
beforeEach(()=>mocks.invoke.mockImplementation(async(name:string)=>name==="listBirds"?[bird]:name==="listPairs"?[pair]:name==="listCages"?[{cageId:"cage-internal",name:"Garden Aviary",code:"A-01",status:"active"}]:name==="getPairDetails"?pair:name==="getDashboardSummary"?{}:name.startsWith("list")?[]:{}));
afterEach(()=>{cleanup();mocks.invoke.mockReset()});

describe("Phase 1 visual refinements",()=>{
  it("keeps the Bird action in the final structured registry cell",async()=>{
    render(<App/>);fireEvent.click(await screen.findByRole("button",{name:"Birds"}));
    const row=await screen.findByRole("button",{name:/Ring ID: BMB-01/});
    expect(row.children).toHaveLength(6);expect(row.lastElementChild?.textContent).toBe("ดู →");expect(row.textContent).not.toContain("bird-internal");
  });

  it("collapses breeding forms by default and reveals only the selected existing form",async()=>{
    render(<App/>);fireEvent.click(await screen.findByRole("button",{name:"Breeding"}));
    expect(screen.queryByRole("heading",{name:"เพิ่มกรง"})).toBeNull();expect(screen.queryByRole("heading",{name:"สร้างคู่"})).toBeNull();
    const action=screen.getByRole("button",{name:"สร้างคู่"});expect(action.getAttribute("aria-expanded")).toBe("false");fireEvent.click(action);
    expect(screen.getByRole("heading",{name:"สร้างคู่"})).toBeTruthy();expect(screen.queryByRole("heading",{name:"เพิ่มกรง"})).toBeNull();expect(action.getAttribute("aria-expanded")).toBe("true");
  });

  it("hides the Cage registry and duplicate assignment summary while Pair Detail is focused",async()=>{
    render(<App/>);fireEvent.click(await screen.findByRole("button",{name:"Breeding"}));fireEvent.click(await screen.findByRole("button",{name:/พ่อนก: Sunny/}));
    await waitFor(()=>expect(screen.getByRole("heading",{name:"คู่ — รายละเอียด"})).toBeTruthy());
    expect(screen.queryByRole("heading",{name:"กรง"})).toBeNull();
    const main=screen.getByRole("main");expect(within(main).queryByText(/Garden Aviary · Code: A-01 ·/)).toBeNull();expect(main.textContent).not.toContain("pair-internal");
  });
});
