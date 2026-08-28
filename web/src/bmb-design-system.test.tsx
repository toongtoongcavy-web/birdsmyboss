import { render,screen } from "@testing-library/react";
import { describe,expect,it } from "vitest";
import { BmbMetric,LifecycleEvent,LineageNode,OperationalSignal,OrangeRing,PairRelationship,ProvenanceMarker,SummaryGroup,TrustMarker } from "./bmb-design-system";

describe("BMB Design System primitives",()=>{
  it("provides reusable Orange Ring variants without accessible decoration noise",()=>{const{container}=render(<><OrangeRing variant="compact"/><OrangeRing variant="selected"/></>);expect(container.querySelector(".orange-ring--compact")).toBeTruthy();expect(container.querySelector(".orange-ring--selected")?.getAttribute("aria-hidden")).toBe("true")});
  it("keeps trust and provenance meaning readable without color",()=>{render(<><TrustMarker>Verified</TrustMarker><ProvenanceMarker>Hatched</ProvenanceMarker></>);expect(screen.getByText("Verified")).toBeTruthy();expect(screen.getByText("Hatched")).toBeTruthy()});
  it("exposes semantic lineage and lifecycle variants",()=>{const{container}=render(<><LineageNode role="bird" title="Sunny" identifier="BMB-2401"/><LifecycleEvent tone="weight">92 grams</LifecycleEvent></>);expect(screen.getByText("BMB-2401")).toBeTruthy();expect(container.querySelector(".bmb-lifecycle-event--weight")).toBeTruthy()});
  it("supports hierarchical metrics and honest operational groups",()=>{render(<SummaryGroup eyebrow="Breeding" title="Current"><BmbMetric label="Birds" value={12} kind="primary"/><OperationalSignal label="Pairs" value={2}/></SummaryGroup>);expect(screen.getByText("Birds").nextElementSibling?.textContent).toBe("12");expect(screen.getByText("Pairs").nextElementSibling?.textContent).toBe("2")});
  it("keeps both Bird identities textual while the Pair connection remains decorative",()=>{const{container}=render(<PairRelationship leftName="Father" leftIdentifier="M-01" rightName="Mother" rightIdentifier="F-01"/>);expect(screen.getByText("Father")).toBeTruthy();expect(screen.getByText("Mother")).toBeTruthy();expect(screen.getByText("Ring ID: M-01")).toBeTruthy();expect(screen.getByText("Ring ID: F-01")).toBeTruthy();expect(container.querySelector(".bmb-pair-link")?.getAttribute("aria-hidden")).toBe("true")});
});
