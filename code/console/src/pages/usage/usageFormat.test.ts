import { describe, expect, it } from "vitest";
import { countIn, dayLabel, rangeLabel } from "./usageFormat";

describe("the date and number words on the Usage pages", () => {
  it("names a day in UTC from the start of an ISO timestamp", () => {
    expect(dayLabel("2026-10-03T23:30:00Z", "en")).toBe("Oct 3");
    expect(dayLabel("2026-10-03", "en")).toBe("Oct 3");
  });

  it("writes a day in the reader's language", () => {
    expect(dayLabel("2026-10-03", "de")).toMatch(/3\. Okt/);
  });

  it("shows a range from the first to the last day with an en dash", () => {
    expect(rangeLabel({ from: "2026-10-01", to: "2026-10-31", rows: [] }, "en")).toBe("Oct 1 – Oct 31");
  });

  it("shows a single day when the range starts and ends on it", () => {
    expect(rangeLabel({ from: "2026-10-05", to: "2026-10-05T18:00:00Z", rows: [] }, "en")).toBe("Oct 5");
  });

  it("leaves out an end the hub did not send", () => {
    expect(rangeLabel({ from: "2026-10-05", to: "", rows: [] }, "en")).toBe("Oct 5 – ");
  });

  it("groups thousands by the language", () => {
    expect(countIn(1234567, "en")).toBe("1,234,567");
    expect(countIn(1234567, "de")).toBe("1.234.567");
  });
});
