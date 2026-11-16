import { describe, expect, it } from "vitest";
import { dayKey, dayLabel, timeOf } from "./time";

const noon = (day: number, month = 9) => new Date(2026, month, day, 12, 0, 0).toISOString();

describe("a time from the tool", () => {
  it("shows hours and minutes with a leading zero", () => {
    expect(timeOf(new Date(2026, 9, 5, 7, 4).toISOString())).toBe("07:04");
  });

  it.each(["", "not a date", "2026-13-45"])("shows nothing for %j", (iso) => {
    expect(timeOf(iso)).toBe("");
    expect(dayKey(iso)).toBe("");
    expect(dayLabel(iso)).toBe("");
  });
});

describe("the day a message belongs to", () => {
  it("gives two times on one day the same key", () => {
    expect(dayKey(new Date(2026, 9, 5, 0, 5).toISOString())).toBe(dayKey(new Date(2026, 9, 5, 23, 55).toISOString()));
  });

  it("gives the same day number in different months different keys", () => {
    expect(dayKey(noon(5, 9))).not.toBe(dayKey(noon(5, 10)));
  });

  it("labels the current day Today", () => {
    expect(dayLabel(noon(5), new Date(2026, 9, 5, 23, 0))).toBe("Today");
  });

  it("labels another day with weekday, day and month", () => {
    expect(dayLabel(noon(4), new Date(2026, 9, 5))).toBe("Sun 4 Oct");
  });

  it("does not call the same date a year earlier Today", () => {
    expect(dayLabel(new Date(2025, 9, 5, 12).toISOString(), new Date(2026, 9, 5))).toBe("Sun 5 Oct");
  });
});
