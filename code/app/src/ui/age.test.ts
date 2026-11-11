import { describe, expect, it } from "vitest";
import { words } from "../entry/words";
import { swahili } from "../entry/swahili";
import { magyar } from "../entry/magyar";
import { ageOf, ageWords } from "./age";

const created = "2026-11-10T08:00:00Z";
const after = (minutes: number) => Date.parse(created) + minutes * 60_000;
const read = (minutes: number) => {
  const age = ageOf(created, after(minutes));
  return age ? ageWords(age, words) : null;
};

describe("ageOf and ageWords", () => {
  it("reads one minute as 1 min", () => {
    expect(read(1)).toBe("1 min");
  });

  it("reads less than a minute, and none at all, as 1 min", () => {
    expect(ageWords(ageOf(created, Date.parse(created) + 20_000)!, words)).toBe("1 min");
    expect(read(0)).toBe("1 min");
  });

  it("reads 59 minutes as 59 min", () => {
    expect(read(59)).toBe("59 min");
  });

  it("reads 60 minutes as 1 h", () => {
    expect(read(60)).toBe("1 h");
  });

  it("reads hours from one hour, rounding down", () => {
    expect(read(61)).toBe("1 h");
    expect(read(340)).toBe("5 h");
    expect(read(12 * 60)).toBe("12 h");
  });

  it("reads 23 hours 59 minutes as 23 h", () => {
    expect(read(23 * 60 + 59)).toBe("23 h");
  });

  it("reads exactly one day as 1 day", () => {
    expect(read(24 * 60)).toBe("1 day");
  });

  it("reads days from one day, rounding down", () => {
    expect(read(3 * 24 * 60)).toBe("3 days");
    expect(read(3 * 24 * 60 + 1439)).toBe("3 days");
    expect(read(120 * 24 * 60)).toBe("120 days");
  });

  it("reads a created date in the future as 1 min", () => {
    expect(read(-90)).toBe("1 min");
    expect(read(-5 * 24 * 60)).toBe("1 min");
  });

  it("gives no age for a missing or unreadable created date", () => {
    expect(ageOf(undefined, Date.now())).toBeNull();
    expect(ageOf("", Date.now())).toBeNull();
    expect(ageOf("soon", Date.now())).toBeNull();
  });

  it("gives no age when the end is not a time", () => {
    expect(ageOf(created, Number.NaN)).toBeNull();
  });

  it("reads its unit words from the language words", () => {
    const age = { unit: "day" as const, count: 3 };
    expect(ageWords(age, swahili)).toBe(swahili.ageDaysMany.replace("{count}", "3"));
    expect(ageWords(age, magyar)).toBe(magyar.ageDaysMany.replace("{count}", "3"));
    expect(ageWords({ unit: "min", count: 5 }, swahili)).toBe(swahili.ageMinutes.replace("{count}", "5"));
    expect(ageWords({ unit: "hour", count: 5 }, magyar)).toBe(magyar.ageHours.replace("{count}", "5"));
  });
});
