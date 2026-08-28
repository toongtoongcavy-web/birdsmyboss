import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({operator:vi.fn()}));
vi.mock("./OperatorGate",()=>({OperatorGate:()=>{mocks.operator();return <div>Operator login</div>}}));
vi.mock("./components/PublicPassport",()=>({PublicPassport:({publicToken}:{publicToken?:string})=><div>Public route {publicToken}</div>}));
import { Root } from "./Root";
afterEach(()=>{cleanup();vi.clearAllMocks()});
it("opens a public Passport path without mounting authentication",()=>{render(<Root pathname="/passport/public-token"/>);expect(screen.getByText("Public route public-token")).toBeTruthy();expect(mocks.operator).not.toHaveBeenCalled()});
it("keeps non-Passport paths behind the operator gate",()=>{render(<Root pathname="/"/>);expect(screen.getByText("Operator login")).toBeTruthy();expect(mocks.operator).toHaveBeenCalledOnce()});
