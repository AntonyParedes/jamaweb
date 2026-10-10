import { describe, expect, it } from "vitest";
import { discountPercent } from "./products";

describe("discountPercent", () => {
  it("S/ 25 → S/ 15 is 40% off", () => {
    expect(discountPercent(15, 25)).toBe(40);
  });
  it("no discount when price is not lower", () => {
    expect(discountPercent(25, 25)).toBe(0);
  });
});
