import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
vi.mock("qrcode",()=>({default:{toString:vi.fn(async(url:string)=>`<svg><text>${url}</text></svg>`)}}));
import { PassportPublicAccess } from "./PassportPublicAccess";
afterEach(cleanup);
it("shows canonical Open, Copy, and locally encoded QR only for a published token",async()=>{render(<PassportPublicAccess passportStatus="published" publicToken="safe-token"/>);const link=screen.getByRole("link",{name:"เปิด Public Passport"}) as HTMLAnchorElement;expect(link.href).toBe("http://localhost:3000/passport/safe-token");const qr=await screen.findByAltText("QR สำหรับ Public Passport") as HTMLImageElement;expect(decodeURIComponent(qr.src)).toContain("http://localhost:3000/passport/safe-token");expect(document.body.textContent).not.toContain("uuid")});
it.each(["draft","disabled"])("does not expose a usable link for %s",status=>{render(<PassportPublicAccess passportStatus={status} publicToken="hidden-token"/>);expect(screen.queryByRole("link")).toBeNull();expect(screen.queryByAltText("QR สำหรับ Public Passport")).toBeNull()});
