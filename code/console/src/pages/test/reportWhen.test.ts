import { describe, expect, it } from "vitest";
import { reportWhen } from "./reportWhen";

const moment = new Date(2026, 9, 28, 10, 5).toISOString();

describe("the date and time a report carries", () => {
  it("names the day, the month, the year and the time, even for a run of today", () => {
    const written = reportWhen(moment, "en");
    expect(written).toContain("2026");
    expect(written).toContain("28");
    expect(written).toContain("10:05");
  });

  it("is written in the language asked for", () => {
    expect(reportWhen(moment, "de")).not.toBe(reportWhen(moment, "en"));
  });

  it("gives back the text it was given when it is not a time", () => {
    expect(reportWhen("", "en")).toBe("");
    expect(reportWhen("later", "en")).toBe("later");
  });
});
