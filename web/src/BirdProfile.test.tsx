import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BirdProfile } from "./BirdProfile";

const data={birdId:"internal-bird-id",displayName:"Sunny",ringId:"BMB-2401",status:"active",mutation:"Lutino",origin:"farm_hatched",hatchedOn:"2025-03-12",passportStatus:"published",parentage:{male:{displayName:"Atlas",ringId:"BMB-2201"},female:{displayName:"Luna",ringId:"BMB-2207"}},photos:[]};

describe("signature Bird Profile",()=>{
  it("makes identity, Ring ID, lineage, history, and Passport readable without exposing internal ID",()=>{
    render(<BirdProfile data={data} currentSex="male" sexHistory={[{sex:"male",method:"dna",determinedOn:"2025-08-10"}]} weightHistory={[{weightGrams:92,measuredOn:"2026-08-10"}]} forms={<div>forms</div>} passport={<div>passport controls</div>}/>);
    expect(screen.getByRole("heading",{name:"Sunny"})).toBeTruthy();expect(screen.getAllByText("BMB-2401").length).toBeGreaterThan(0);expect(screen.getByLabelText("ยังไม่มีภาพนกที่เผยแพร่")).toBeTruthy();
    expect(screen.getByText("อยู่ในฟาร์ม")).toBeTruthy();
    expect(screen.getByLabelText("ข้อมูลประจำตัวนก").className).toContain("bird-visual-current");
    expect(screen.getByText("Atlas")).toBeTruthy();expect(screen.getByText("Luna")).toBeTruthy();expect(screen.getByRole("heading",{name:"Bird Passport"})).toBeTruthy();expect(document.body.textContent).not.toContain("internal-bird-id");
  });

  it.each([
    ["TERM-01", "sold", "ขายแล้ว"],
    ["TERM-02", "given_away", "Given Away"],
    ["TERM-03", "deceased", "เสียชีวิต"],
    ["TERM-04", "lost", "Lost"],
  ])("BIRD-11 %s visually recedes a %s Bird while preserving identity and history",(_uatId,status,statusLabel)=>{
    render(<BirdProfile data={{...data,status}} currentSex="male" sexHistory={[{sex:"male",method:"dna",determinedOn:"2025-08-10"}]} weightHistory={[{weightGrams:92,measuredOn:"2026-08-10"}]} forms={null} passport={null}/>);
    const profile=screen.getAllByLabelText("ข้อมูลประจำตัวนก").at(-1)!;
    expect(profile.className).toContain("bird-visual-terminal");
    expect(profile.className).not.toContain("bird-visual-current");
    expect(within(profile).getByText(statusLabel).className).toContain("bird-visual-terminal");
    const birdProfile=profile.closest<HTMLElement>(".bird-profile")!;
    expect(within(birdProfile).getByRole("heading",{name:"Sunny"})).toBeTruthy();
    expect(within(birdProfile).getAllByText("BMB-2401").length).toBeGreaterThan(0);
    expect(within(birdProfile).getByText("ตัวผู้ · 10/08/2025")).toBeTruthy();
    expect(within(birdProfile).getByText("92 กรัม · 10/08/2026")).toBeTruthy();
  });

  it("uses only an explicitly published trusted photo",()=>{
    const {rerender}=render(<BirdProfile data={{...data,photos:[{publicUrl:"https://example.test/private.jpg",isPublicOnPassport:false}]}} currentSex="male" sexHistory={[]} weightHistory={[]} forms={null} passport={null}/>);
    expect(screen.queryByRole("img")).toBeNull();rerender(<BirdProfile data={{...data,photos:[{publicUrl:"https://example.test/published.jpg",isPublicOnPassport:true,caption:"Sunny portrait"}]}} currentSex="male" sexHistory={[]} weightHistory={[]} forms={null} passport={null}/>);expect(screen.getByRole("img",{name:"ภาพของ Sunny"})).toBeTruthy();
  });

  it("shows the authoritative current cage and a truthful unassigned state",()=>{
    const {rerender}=render(<BirdProfile data={{...data,currentCageId:"cage-id",currentCageCode:"A-01",currentCageName:"Garden Aviary"}} currentSex="male" sexHistory={[]} weightHistory={[]} forms={null} passport={null}/>);
    const profile=screen.getAllByLabelText("ข้อมูลประจำตัวนก").at(-1)!.closest<HTMLElement>(".bird-profile")!;
    expect(within(profile).getByText("กรงปัจจุบัน")).toBeTruthy();expect(within(profile).getByText("A-01 — Garden Aviary")).toBeTruthy();expect(profile.textContent).not.toContain("cage-id");
    rerender(<BirdProfile data={{...data,currentCageId:null,currentCageCode:null,currentCageName:null}} currentSex="male" sexHistory={[]} weightHistory={[]} forms={null} passport={null}/>);
    expect(within(profile).getByText("ยังไม่ได้จัดกรง")).toBeTruthy();
  });

  it("keeps legacy rescued provenance readable as external intake",()=>{
    render(<BirdProfile data={{...data,origin:"rescued"}} currentSex="unknown" sexHistory={[]} weightHistory={[]} forms={null} passport={null}/>);
    expect(screen.getByText("รับเข้าจากภายนอก")).toBeTruthy();
  });
});
