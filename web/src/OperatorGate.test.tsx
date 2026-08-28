import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ observe: vi.fn(), signIn: vi.fn(), signOut: vi.fn(), privateApp: vi.fn() }));
vi.mock("./auth", () => ({ observeOperator: mocks.observe, signInOperatorWithGoogle: mocks.signIn, signOutOperator: mocks.signOut }));
vi.mock("./App", () => ({ App: () => { mocks.privateApp(); return <div>Private operator application</div>; } }));
vi.mock("./components/PublicPassport", () => ({ PublicPassport: () => <div>Public Passport resolver</div> }));
import { OperatorGate } from "./OperatorGate";

describe("operator authentication boundary", () => {
  afterEach(cleanup);
  beforeEach(() => { vi.clearAllMocks(); mocks.observe.mockImplementation((listener) => { listener(null); return vi.fn(); }); });
  it("shows signed-out Google login and public Passport without private screens", () => {
    render(<OperatorGate />); expect(screen.getByRole("button", { name: "เข้าสู่ระบบด้วย Google" })).toBeTruthy(); expect(screen.getByText("Public Passport resolver")).toBeTruthy(); expect(mocks.privateApp).not.toHaveBeenCalled();
  });
  it("invokes Google sign-in and exposes signing-in state", async () => {
    let finish!: () => void; mocks.signIn.mockReturnValue(new Promise<void>(resolve => { finish = resolve; })); render(<OperatorGate />); fireEvent.click(screen.getByRole("button", { name: "เข้าสู่ระบบด้วย Google" })); expect((screen.getByRole("button", { name: "กำลังเข้าสู่ระบบ…" }) as HTMLButtonElement).disabled).toBe(true); finish(); await waitFor(() => expect(mocks.signIn).toHaveBeenCalledOnce());
  });
  it("shows signed-in identity and private application", () => {
    mocks.observe.mockImplementation((listener) => { listener({ uid: "operator-1", displayName: "Farm Operator", email: "operator@example.test", isOperator: true }); return vi.fn(); }); render(<OperatorGate />); expect(screen.getByText("ผู้ใช้งาน: Farm Operator")).toBeTruthy(); expect(screen.getByText("Private operator application")).toBeTruthy(); expect(mocks.privateApp).toHaveBeenCalledOnce();
  });
  it("signs the operator out", async () => {
    mocks.observe.mockImplementation((listener) => { listener({ uid: "operator-1", displayName: null, email: "operator@example.test", isOperator: true }); return vi.fn(); }); mocks.signOut.mockResolvedValue(undefined); render(<OperatorGate />); fireEvent.click(screen.getByRole("button", { name: "ออกจากระบบ" })); await waitFor(() => expect(mocks.signOut).toHaveBeenCalledOnce());
  });
  it("reports Google authentication failure", async () => {
    mocks.signIn.mockRejectedValue(new Error("popup failed")); render(<OperatorGate />); fireEvent.click(screen.getByRole("button", { name: "เข้าสู่ระบบด้วย Google" })); expect((await screen.findByRole("alert")).textContent).toContain("ไม่สามารถเข้าสู่ระบบด้วย Google ได้");
  });
  it("denies a signed-in non-operator without mounting private UI and preserves Passport", () => {
    mocks.observe.mockImplementation((listener) => { listener({ uid: "user-1", displayName: "Google User", email: "user@example.test", isOperator: false }); return vi.fn(); }); render(<OperatorGate />); expect(screen.getByRole("heading", { name: "ไม่ได้รับสิทธิ์" })).toBeTruthy(); expect(screen.getByText("Public Passport resolver")).toBeTruthy(); expect(mocks.privateApp).not.toHaveBeenCalled();
  });
  it("allows a denied user to sign out", async () => {
    mocks.observe.mockImplementation((listener) => { listener({ uid: "user-1", displayName: null, email: "user@example.test", isOperator: false }); return vi.fn(); }); mocks.signOut.mockResolvedValue(undefined); render(<OperatorGate />); fireEvent.click(screen.getByRole("button", { name: "ออกจากระบบ" })); await waitFor(() => expect(mocks.signOut).toHaveBeenCalledOnce());
  });
  it("does not mount private UI while claims are loading", () => {
    mocks.observe.mockImplementation(() => vi.fn()); render(<OperatorGate />); expect(screen.getByText("กำลังตรวจสอบสถานะการเข้าสู่ระบบ…")).toBeTruthy(); expect(mocks.privateApp).not.toHaveBeenCalled();
  });
});
