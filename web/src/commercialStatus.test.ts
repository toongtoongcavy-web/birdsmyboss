import { describe, expect, it } from "vitest";
import { displayBreedingCycleStatus, displayCustomerStatus, displayReservationStatus, displayValue } from "./presentation";

describe("context-specific Commercial status labels", () => {
  it("maps Customer statuses without changing the Bird active label", () => {
    expect(displayCustomerStatus("active")).toBe("ใช้งานอยู่");
    expect(displayCustomerStatus("inactive")).toBe("ไม่ใช้งาน");
    expect(displayValue("active")).toBe("อยู่ในฟาร์ม");
  });

  it("maps all supported Reservation statuses", () => {
    expect(displayReservationStatus("active")).toBe("กำลังจอง");
    expect(displayReservationStatus("cancelled")).toBe("ยกเลิกการจอง");
    expect(displayReservationStatus("expired")).toBe("การจองหมดอายุ");
  });

  it("preserves the breeding-cycle active label", () => {
    expect(displayBreedingCycleStatus("active")).toBe("เปิดรอบแล้ว");
  });
});
