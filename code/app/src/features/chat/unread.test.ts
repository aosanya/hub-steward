import { describe, expect, it } from "vitest";
import { stampOf } from "./stamp";
import { unreadLabel } from "./unread";

describe("the unread badge", () => {
  it.each([null, undefined, 0, -3, NaN, Infinity, 0.5])("shows nothing for %s", (count) => {
    expect(unreadLabel(count as number)).toBe("");
  });

  it("shows the count up to 99", () => {
    expect(unreadLabel(1)).toBe("1");
    expect(unreadLabel(99)).toBe("99");
  });

  it("shows 99+ beyond that", () => {
    expect(unreadLabel(100)).toBe("99+");
    expect(unreadLabel(5000)).toBe("99+");
  });

  it("shows a whole number for a fraction above one", () => {
    expect(unreadLabel(2.7)).toBe("2");
  });

  it("shows nothing for a string count the tool sent by mistake", () => {
    expect(unreadLabel("3" as unknown as number)).toBe("");
  });
});

describe("the stamp beside a room", () => {
  const now = new Date(2026, 9, 5, 18, 0);

  it("shows the time for today", () => {
    expect(stampOf(new Date(2026, 9, 5, 7, 4).toISOString(), now)).toBe("07:04");
  });

  it("shows the day for an earlier day", () => {
    expect(stampOf(new Date(2026, 9, 3, 7, 4).toISOString(), now)).toBe("Sat 3 Oct");
  });

  it.each([undefined, "", "garbage"])("shows nothing for %j", (iso) => {
    expect(stampOf(iso, now)).toBe("");
  });
});
