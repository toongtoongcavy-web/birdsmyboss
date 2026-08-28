import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({invoke:vi.fn()}));
vi.mock("../functions",()=>({invoke:mocks.invoke,thaiError:()=>"private error"}));
import { PublicPassport } from "./PublicPassport";
afterEach(()=>{cleanup();vi.clearAllMocks()});
it("resolves a path token automatically without login or token input",async()=>{mocks.invoke.mockResolvedValue({ringId:"PUBLIC-1",sex:"female",hatchedOn:"2026-08-14",parentage:{male:{ringId:"DAD-1"},female:{ringId:"MOM-1"}},photos:[],documents:[]});render(<PublicPassport publicToken="route-token"/>);await waitFor(()=>expect(mocks.invoke).toHaveBeenCalledWith("getBirdPassport",{publicToken:"route-token"}));expect(await screen.findByText("Ring ID: PUBLIC-1")).toBeTruthy();expect(screen.getByText("วันฟัก")).toBeTruthy();expect(screen.getByText("14/08/2026")).toBeTruthy();expect(screen.getByText("DAD-1")).toBeTruthy();expect(screen.getByText("MOM-1")).toBeTruthy();expect(screen.queryByLabelText("Public Token")).toBeNull();expect(document.body.textContent).not.toMatch(/uuid|birdId|customerId|handoverId/i)});
it("uses one neutral state for every unavailable token result",async()=>{mocks.invoke.mockResolvedValue(null);render(<PublicPassport publicToken="old-or-hidden"/>);expect((await screen.findByRole("alert")).textContent).toBe("ไม่พบ Passport หรือ Passport นี้ยังไม่เปิดเผย");expect(screen.queryByText(/draft|disabled|rotated/i)).toBeNull()});
