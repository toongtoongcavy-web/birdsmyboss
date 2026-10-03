import { describe, expect, it } from "vitest";
import { thaiError } from "./functions";

describe("thaiError", () => {
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
