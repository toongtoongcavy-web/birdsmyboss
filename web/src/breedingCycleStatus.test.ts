import { describe, expect, it } from "vitest";
import { displayBreedingCycleStatus, displayValue } from "./presentation";

describe("breeding-cycle status labels", () => {
  it("uses cycle-specific Thai labels for open, closed, and cancelled cycles", () => {
    expect(displayBreedingCycleStatus("active")).toBe("เปิดรอบแล้ว");
    expect(displayBreedingCycleStatus("closed")).toBe("ปิดรอบแล้ว");
    expect(displayBreedingCycleStatus("cancelled")).toBe("ยกเลิก");
  });

  it("keeps the existing active bird label unchanged", () => {
    expect(displayValue("active")).toBe("อยู่ในฟาร์ม");
  });
});
