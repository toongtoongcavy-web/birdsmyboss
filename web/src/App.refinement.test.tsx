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
    expect(screen.getByRole("heading",{name:"คู่เพาะ"})).toBeTruthy();
    const main=screen.getByRole("main");expect(within(main).queryByText(/Garden Aviary · Code: A-01 ·/)).toBeNull();expect(main.textContent).not.toContain("pair-internal");
  });

  it("keeps the iPad-first Pair registry searchable with visible Cage context",async()=>{
    render(<App/>);fireEvent.click(await screen.findByRole("button",{name:"Breeding"}));
    const summary=screen.getByLabelText("สรุปการเพาะพันธุ์");
    for(const label of ["คู่เพาะทั้งหมด","คู่ที่ใช้งาน","กรงที่ใช้งาน","คู่ที่รอจัดกรง"])expect(within(summary).getByText(label)).toBeTruthy();
    const pair=await screen.findByRole("button",{name:/พ่อนก: Sunny/});
    expect(pair.textContent).toContain("A-01 · Garden Aviary");expect(pair.textContent).toContain("01/07/2026");expect(pair.textContent).toContain("อยู่ในฟาร์ม");
    const search=screen.getByRole("textbox",{name:"ค้นหาคู่เพาะ"});fireEvent.change(search,{target:{value:"ไม่พบคู่นี้"}});
    expect(screen.queryByRole("button",{name:/พ่อนก: Sunny/})).toBeNull();expect(screen.getByText("ไม่พบคู่เพาะที่ตรงกับการค้นหา")).toBeTruthy();
    fireEvent.change(search,{target:{value:"A-01"}});expect(await screen.findByRole("button",{name:/พ่อนก: Sunny/})).toBeTruthy();
  });
});
