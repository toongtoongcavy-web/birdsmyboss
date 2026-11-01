import { describe, expect, it } from "vitest";
import { thaiError } from "./functions";

describe("thaiError", () => {
  it.each([
    "Retained sale money requires an explicit cancellation disposition.",
    "Sale cancellation balance changed; review the current balance.",
    "Sale cancellation partial refund must be less than the retained balance.",
    "Cancelled sale cannot receive payments.",
    "Cancelled sale refunds require an explicit settlement workflow.",
    "Sale with a non-cancelled handover cannot be cancelled.",
  ])("maps Sale cancellation integrity errors to Thai: %s",message=>{
    const result=thaiError({code:"functions/failed-precondition",message});
    expect(result).toMatch(/[ก-๙]/);expect(result).not.toContain(message);
  });
  it("translates retained reservation money rejection without leaking raw details",()=>{
    expect(thaiError({code:"functions/failed-precondition",message:"Retained reservation money requires an explicit cancellation disposition."})).toBe("การจองนี้มีเงินที่รับไว้ กรุณาระบุวิธีจัดการเงินก่อนยกเลิกการจอง");
  });
  it("keeps known Reservation conversion failures friendly and diagnostic", () => {
    expect(thaiError({
      code: "functions/invalid-argument",
      message: "Reservation conversion must not supply agreement price fields.",
    })).toContain("อัปเดต Functions");
  });

  it("surfaces a sanitized callable code and message for unknown failures", () => {
    const result = thaiError({ code: "functions/failed-precondition", message: "Unexpected domain condition\nwithout a stack" });
    expect(result).toContain("failed-precondition");
    expect(result).toContain("Unexpected domain condition without a stack");
    expect(result).not.toContain("\n");
  });

  it("does not expose unrelated object properties", () => {
    expect(thaiError({ stack: "secret stack", details: "secret details" })).toBe("ไม่สามารถบันทึกข้อมูลได้ กรุณาตรวจสอบอีกครั้ง");
  });
});
