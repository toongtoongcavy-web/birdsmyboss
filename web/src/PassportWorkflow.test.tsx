import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const mocks=vi.hoisted(()=>({invoke:vi.fn(),refresh:vi.fn(async()=>{})}));
vi.mock("./functions",()=>({invoke:mocks.invoke,thaiError:()=>"ผิดพลาด"}));
import { PassportWorkflow } from "./PassportWorkflow";

const birds=[
  {birdId:"uuid-secret-1",ringId:"SMOKE-CHICK-01",displayName:"SMOKE Name CHICK 01",currentSex:"female",mutation:"Blue",status:"sold",passportStatus:"draft"},
  {birdId:"uuid-secret-2",ringId:"BMB-002",displayName:"มะเขือเปราะ",currentSex:"male",mutation:"Green",status:"active",passportStatus:"published"},
];
const detail={...birds[0],hatchedOn:"2026-07-01",origin:"farm_hatched",parentage:{male:{ringId:"DAD-1",displayName:"Dad"},female:{ringId:"MOM-1",displayName:"Mom"}},photos:[],documents:[]};

afterEach(()=>{cleanup();vi.clearAllMocks()});

it("searches by Ring ID and name while concealing Bird UUID",()=>{
  mocks.invoke.mockResolvedValue(detail);
  const {rerender}=render(<PassportWorkflow birds={birds} handovers={[]} onRefresh={mocks.refresh}/>);
  fireEvent.change(screen.getByLabelText("ค้นหานกสำหรับ Passport"),{target:{value:"SMOKE-CHICK"}});
  expect(screen.getByText("SMOKE Name CHICK 01")).toBeTruthy();
  expect(screen.queryByText("มะเขือเปราะ")).toBeNull();
  expect(screen.queryByText(/uuid-secret/)).toBeNull();
  rerender(<PassportWorkflow birds={birds} handovers={[]} onRefresh={mocks.refresh}/>);
  fireEvent.change(screen.getByLabelText("ค้นหานกสำหรับ Passport"),{target:{value:"มะเขือ"}});
  expect(screen.getByText("มะเขือเปราะ")).toBeTruthy();
});

it("shows human Passport context and canonical completed handover date",async()=>{
  mocks.invoke.mockResolvedValue(detail);
  render(<PassportWorkflow birds={birds} handovers={[{handoverId:"hidden",birdId:"uuid-secret-1",status:"completed",handoverOn:"2026-08-14"}]} onRefresh={mocks.refresh}/>);
  fireEvent.click(screen.getByText("SMOKE Name CHICK 01"));
  expect(await screen.findByText("Passport Detail")).toBeTruthy();
  expect(screen.getByText("วันส่งมอบ: 14/08/2026")).toBeTruthy();
  expect(screen.getByText(/DAD-1/)).toBeTruthy();
  expect(screen.queryByText(/uuid-secret|hidden|Public Token|Bird ID/)).toBeNull();
  expect(mocks.invoke).toHaveBeenCalledWith("getBirdDetails",{birdId:"uuid-secret-1"});
});

it("uses selected canonical ID and authoritatively refetches after status change",async()=>{
  mocks.invoke.mockImplementation(async(name:string)=>name==="getBirdDetails"?detail:{});
  render(<PassportWorkflow birds={birds} handovers={[]} onRefresh={mocks.refresh}/>);
  fireEvent.click(screen.getByText("SMOKE Name CHICK 01"));
  await screen.findByText("Passport Detail");
  fireEvent.click(screen.getByRole("button",{name:"เผยแพร่ Passport"}));
  await waitFor(()=>expect(mocks.invoke).toHaveBeenCalledWith("setPassportStatus",{birdId:"uuid-secret-1",passportStatus:"published"}));
  await waitFor(()=>expect(mocks.refresh).toHaveBeenCalled());
  expect(mocks.invoke.mock.calls.filter(call=>call[0]==="getBirdDetails")).toHaveLength(2);
});

it("preserves trusted detail and context when mutation fails",async()=>{
  mocks.invoke.mockImplementation(async(name:string)=>{if(name==="setPassportStatus")throw new Error("no");return detail});
  render(<PassportWorkflow birds={birds} handovers={[]} onRefresh={mocks.refresh}/>);
  fireEvent.click(screen.getByText("SMOKE Name CHICK 01"));
  await screen.findByText("Passport Detail");
  fireEvent.click(screen.getByRole("button",{name:"เผยแพร่ Passport"}));
  expect((await screen.findByRole("alert")).textContent).toBe("ผิดพลาด");
  expect(screen.getByText("PUBLICATION STATUS")).toBeTruthy();
  expect(screen.getByText("draft")).toBeTruthy();
  expect(screen.getByText("แบบร่าง")).toBeTruthy();
  expect(screen.getByText("SMOKE Name CHICK 01")).toBeTruthy();
  expect(mocks.refresh).not.toHaveBeenCalled();
});

it("updates the public link and QR from authoritative token readback after rotation",async()=>{
  const oldDetail={...detail,passportStatus:"published",publicToken:"old-token"};
  const newDetail={...oldDetail,publicToken:"new-token"};
  let reads=0;
  mocks.invoke.mockImplementation(async(name:string)=>name==="getBirdDetails"?(++reads===1?oldDetail:newDetail):{});
  render(<PassportWorkflow birds={birds} handovers={[]} onRefresh={mocks.refresh}/>);
  fireEvent.click(screen.getByText("SMOKE Name CHICK 01"));
  const oldLink=await screen.findByRole("link",{name:"เปิด Public Passport"}) as HTMLAnchorElement;
  expect(oldLink.href).toContain("/passport/old-token");
  fireEvent.click(screen.getByRole("button",{name:"หมุน Token ใหม่"}));
  fireEvent.click(screen.getByRole("button",{name:"ยืนยันหมุน Token"}));
  await waitFor(()=>expect((screen.getByRole("link",{name:"เปิด Public Passport"}) as HTMLAnchorElement).href).toContain("/passport/new-token"));
  expect(await screen.findByAltText("QR สำหรับ Public Passport")).toBeTruthy();
  expect(mocks.invoke).toHaveBeenCalledWith("rotatePassportToken",{birdId:"uuid-secret-1"});
  expect(screen.queryByText(/uuid-secret/)).toBeNull();
});
