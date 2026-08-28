import { expect, it } from "vitest";
import { publicPassportPath, publicPassportTokenFromPath, publicPassportUrl } from "./passportRoute";

it("uses the canonical token-only Passport path",()=>{
  expect(publicPassportPath("abc_123-XYZ")).toBe("/passport/abc_123-XYZ");
  expect(publicPassportUrl("abc_123-XYZ","https://birds.test")).toBe("https://birds.test/passport/abc_123-XYZ");
  expect(publicPassportTokenFromPath("/passport/abc_123-XYZ")).toBe("abc_123-XYZ");
  expect(publicPassportTokenFromPath("/passport/")).toBeNull();
  expect(publicPassportTokenFromPath("/passport/a/extra")).toBeNull();
});
