import { partsOf, ruleOf, ruleWords } from "./scheduleWords";

describe("a schedule rule read as words", () => {
  it("reads a monthly rule on a day of the month", () => {
    expect(ruleWords("FREQ=MONTHLY;BYMONTHDAY=1")).toBe("Every month on the 1st");
    expect(ruleWords("FREQ=MONTHLY;BYMONTHDAY=22")).toBe("Every month on the 22nd");
    expect(ruleWords("FREQ=MONTHLY;BYMONTHDAY=13")).toBe("Every month on the 13th");
  });

  it("reads a weekly and a fortnightly rule on a weekday", () => {
    expect(ruleWords("FREQ=WEEKLY;BYDAY=MO")).toBe("Every week on Monday");
    expect(ruleWords("FREQ=WEEKLY;INTERVAL=1;BYDAY=MO")).toBe("Every week on Monday");
    expect(ruleWords("FREQ=WEEKLY;INTERVAL=2;BYDAY=WE")).toBe("Every 2 weeks on Wednesday");
  });

  it("falls back to the raw rule for any other rule", () => {
    expect(ruleWords("FREQ=MONTHLY;INTERVAL=3")).toBe("FREQ=MONTHLY;INTERVAL=3");
    expect(ruleWords("FREQ=DAILY")).toBe("FREQ=DAILY");
    expect(ruleWords("")).toBe("");
  });

  it("writes back the rule a choice stands for", () => {
    expect(ruleOf({ often: "weekly", weekday: "MO", monthday: "" })).toBe("FREQ=WEEKLY;BYDAY=MO");
    expect(ruleOf({ often: "fortnightly", weekday: "WE", monthday: "" })).toBe("FREQ=WEEKLY;INTERVAL=2;BYDAY=WE");
    expect(ruleOf({ often: "monthly", weekday: "", monthday: "15" })).toBe("FREQ=MONTHLY;BYMONTHDAY=15");
  });

  it("splits a known rule into its choices and gives nothing for an unknown one", () => {
    expect(partsOf("FREQ=MONTHLY;BYMONTHDAY=1")).toEqual({ often: "monthly", weekday: "", monthday: "1" });
    expect(partsOf("FREQ=WEEKLY;INTERVAL=2;BYDAY=WE")).toEqual({ often: "fortnightly", weekday: "WE", monthday: "" });
    expect(partsOf("FREQ=DAILY")).toBeNull();
  });
});
