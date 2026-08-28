import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BirdProfile } from "./BirdProfile";

const data={birdId:"internal-bird-id",displayName:"Sunny",ringId:"BMB-2401",status:"active",mutation:"Lutino",origin:"farm_hatched",hatchedOn:"2025-03-12",passportStatus:"published",parentage:{male:{displayName:"Atlas",ringId:"BMB-2201"},female:{displayName:"Luna",ringId:"BMB-2207"}},photos:[]};

describe("signature Bird Profile",()=>{
  it("makes identity, Ring ID, lineage, history, and Passport readable without exposing internal ID",()=>{
    render(<BirdProfile data={data} currentSex="male" sexHistory={[{sex:"male",method:"dna",determinedOn:"2025-08-10"}]} weightHistory={[{weightGrams:92,measuredOn:"2026-08-10"}]} forms={<div>forms</div>} passport={<div>passport controls</div>}/>);
    expect(screen.getByRole("heading",{name:"Sunny"})).toBeTruthy();expect(screen.getAllByText("BMB-2401").length).toBeGreaterThan(0);expect(screen.getByLabelText("ยังไม่มีภาพนกที่เผยแพร่")).toBeTruthy();
    expect(screen.getByText("Atlas")).toBeTruthy();expect(screen.getByText("Luna")).toBeTruthy();expect(screen.getByRole("heading",{name:"Bird Passport"})).toBeTruthy();expect(document.body.textContent).not.toContain("internal-bird-id");
  });

  it("uses only an explicitly published trusted photo",()=>{
    const {rerender}=render(<BirdProfile data={{...data,photos:[{publicUrl:"https://example.test/private.jpg",isPublicOnPassport:false}]}} currentSex="male" sexHistory={[]} weightHistory={[]} forms={null} passport={null}/>);
    expect(screen.queryByRole("img")).toBeNull();rerender(<BirdProfile data={{...data,photos:[{publicUrl:"https://example.test/published.jpg",isPublicOnPassport:true,caption:"Sunny portrait"}]}} currentSex="male" sexHistory={[]} weightHistory={[]} forms={null} passport={null}/>);expect(screen.getByRole("img",{name:"ภาพของ Sunny"})).toBeTruthy();
  });
});
