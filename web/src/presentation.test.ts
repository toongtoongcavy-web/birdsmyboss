import { describe, expect, it } from "vitest";
import { displayFieldName, displayValue } from "./presentation";

describe("English presentation labels", () => {
  it("formats canonical values without changing them", () => {
    expect(["dna", "sex_linked", "visual", "unknown", "male", "female", "external", "active", "draft"].map(displayValue))
      .toEqual(["DNA", "Sex Linked", "Visual", "Unknown", "Male", "Female", "External", "Active", "Draft"]);
  });

  it("preserves standard ID capitalization", () => {
    expect(displayFieldName("ringId")).toBe("Ring ID");
    expect(displayFieldName("birdId")).toBe("Bird ID");
  });
});
