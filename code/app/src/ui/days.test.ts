import { describe, expect, it } from "vitest";
import { dayWords, isoDay, shortDayWords } from "./days";

describe("isoDay", () => {
  it("keeps the date part of a timestamp", () => {
    expect(isoDay("2026-11-06T10:00:00Z")).toBe("2026-11-06");
  });

  it("keeps a date as it is", () => {
    expect(isoDay("2026-11-06")).toBe("2026-11-06");
  });

  it("says nothing for an empty value", () => {
    expect(isoDay("")).toBe("");
  });
});

describe("dayWords", () => {
  it("writes a date as the weekday, the day and the month", () => {
    expect(dayWords("2026-11-06")).toBe("Friday, 6 Nov");
  });

  it("reads the day of a timestamp in UTC, as the date part says", () => {
    expect(dayWords("2026-11-06T23:30:00Z")).toBe("Friday, 6 Nov");
    expect(dayWords("2026-11-06T10:00:00Z")).toBe("Friday, 6 Nov");
  });

  it("writes September as Sep", () => {
    expect(dayWords("2026-09-01")).toBe("Tuesday, 1 Sep");
  });

  it("reads a timestamp that does not begin with a date", () => {
    expect(dayWords("Fri, 06 Nov 2026 10:00:00 GMT")).toBe("Friday, 6 Nov");
  });

  it("gives back what it cannot read, and an empty value stays empty", () => {
    expect(dayWords("next week")).toBe("next week");
    expect(dayWords("")).toBe("");
  });
});

describe("shortDayWords", () => {
  it("writes a local date as a short weekday, day and month", () => {
    expect(shortDayWords(new Date(2026, 10, 7, 9, 0).toISOString())).toBe("Sat 7 Nov");
  });

  it("answers null for an empty or unreadable value", () => {
    expect(shortDayWords("")).toBeNull();
    expect(shortDayWords("soon")).toBeNull();
  });
});
