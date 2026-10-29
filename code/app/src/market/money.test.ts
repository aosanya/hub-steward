import { kes } from "./money";

describe("kes", () => {
  it("writes the currency and a thousands separator", () => {
    expect(kes(3800)).toBe("KES 3,800");
    expect(kes("3950")).toBe("KES 3,950");
    expect(kes("1250000")).toBe("KES 1,250,000");
    expect(kes(85)).toBe("KES 85");
  });

  it("keeps decimals and leaves words and empty values alone", () => {
    expect(kes("3799.5")).toBe("KES 3,799.5");
    expect(kes("")).toBe("");
    expect(kes("on request")).toBe("on request");
  });
});
