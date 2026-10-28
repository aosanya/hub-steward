import { describe, expect, it } from "vitest";
import { formatWhen } from "./formatWhen";

const at = (day: number, hour: number, minute: number) => new Date(2026, 9, day, hour, minute).toISOString();

describe("the time a row shows", () => {
  const now = new Date(2026, 9, 27, 12, 0);

  it("is only the hour and the minute when the moment is today", () => {
    expect(formatWhen(at(27, 9, 11), "en", now)).toBe("09:11");
  });

  it("carries the month and the day when the moment is on another day", () => {
    expect(formatWhen(at(24, 14, 2), "en", now)).toBe("Oct 24, 14:02");
  });

  it("is written in the language asked for", () => {
    expect(formatWhen(at(24, 14, 2), "de", now)).toContain("14:02");
    expect(formatWhen(at(24, 14, 2), "de", now)).not.toBe(formatWhen(at(24, 14, 2), "en", now));
  });

  it("gives back the text it was given when it is not a time", () => {
    expect(formatWhen("09:10", "en", now)).toBe("09:10");
    expect(formatWhen("", "en", now)).toBe("");
  });
});
