import { describe, expect, it } from "vitest";
import { backlogViewOf } from "./views";
import { backlogLine, issuesWords, stepsWords } from "./words";

describe("reading a card's target", () => {
  it("reads all, backlogs and one backlog by its id", () => {
    expect(backlogViewOf("all")).toEqual({ view: "all" });
    expect(backlogViewOf("backlogs")).toEqual({ view: "backlogs" });
    expect(backlogViewOf("backlog:b1")).toEqual({ view: "backlog", backlogId: "b1" });
  });

  it("keeps a colon inside the backlog id", () => {
    expect(backlogViewOf("backlog:a:b")).toEqual({ view: "backlog", backlogId: "a:b" });
  });

  it("does not read a backlog with no id, or any other target", () => {
    expect(backlogViewOf("backlog:")).toBeNull();
    expect(backlogViewOf("")).toBeNull();
    expect(backlogViewOf("All")).toBeNull();
    expect(backlogViewOf("board:b1")).toBeNull();
  });
});

describe("the words on a backlog card", () => {
  it("counts in singular and plural, with zero as plural", () => {
    expect(issuesWords(0)).toBe("0 issues");
    expect(issuesWords(1)).toBe("1 issue");
    expect(stepsWords(1)).toBe("1 step");
    expect(stepsWords(6)).toBe("6 steps");
  });

  it("says a backlog with steps by issues and steps, and a smart one by issues only", () => {
    expect(backlogLine({ id: "b", name: "Software", issues: 3, steps: 6, smart: false })).toBe("3 issues in 6 steps");
    expect(backlogLine({ id: "b", name: "Software", issues: 1, steps: 1, smart: false })).toBe("1 issue in 1 step");
    expect(backlogLine({ id: "s", name: "Ready", issues: 2, steps: 0, smart: true })).toBe("2 issues");
  });
});
