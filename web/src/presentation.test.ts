import { describe, expect, it } from "vitest";
import { displayFieldName, displayValue } from "./presentation";

describe("accepted presentation labels", () => {
  it("formats canonical values without changing them", () => {
    expect(["dna", "sex_linked", "visual", "unknown", "male", "female", "external", "active", "draft"].map(displayValue))
      .toEqual(["DNA", "Sex Linked", "Visual", "ไม่ทราบเพศ", "ตัวผู้", "ตัวเมีย", "รับเข้าจากภายนอก", "อยู่ในฟาร์ม", "แบบร่าง"]);
  });

  it("preserves standard ID capitalization", () => {
    expect(displayFieldName("ringId")).toBe("รหัสห่วงขา");
    expect(displayFieldName("birdId")).toBe("Bird ID");
  });
});
