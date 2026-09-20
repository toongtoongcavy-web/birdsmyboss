import { describe, expect, it } from "vitest";
import { displaySaleTimelineEvent } from "./presentation";

describe("Sale Timeline presentation", () => {
  it.each([
    ["sale_created", "สร้างรายการขาย"],
    ["payment_recorded", "บันทึกการชำระเงิน"],
    ["refund_decision_recorded", "บันทึกผลการคืนเงิน"],
    ["sale_completed", "ปิดการขาย"],
  ])("maps emitted event %s to Thai", (eventType, label) => {
    expect(displaySaleTimelineEvent(eventType)).toBe(label);
  });

  it("keeps unknown legacy events readable", () => {
    expect(displaySaleTimelineEvent("legacy_manual_adjustment")).toBe("legacy manual adjustment");
    expect(displaySaleTimelineEvent(undefined)).toBe("-");
  });
});
