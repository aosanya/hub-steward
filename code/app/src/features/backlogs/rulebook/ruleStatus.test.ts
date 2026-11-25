import { describe, expect, it } from "vitest";
import { rule } from "./rulebookFixture";
import { priorityTone, statusLabel, statusTone } from "./ruleStatus";

describe("the words and tone of a status", () => {
  it("names the status of each kind", () => {
    expect(statusLabel(rule({ status: "in_force" }))).toBe("In force");
    expect(statusLabel(rule({ kind: "decision", status: "decided" }))).toBe("Decided");
    expect(statusLabel(rule({ kind: "question", status: "open" }))).toBe("Open");
  });

  it("says which rule replaced a superseded one", () => {
    expect(statusLabel(rule({ status: "superseded", supersededBy: "R-1" }))).toBe("Superseded by R-1");
  });

  it("says plain Superseded when nothing is named, and Retired for a retired rule", () => {
    expect(statusLabel(rule({ status: "superseded" }))).toBe("Superseded");
    expect(statusLabel(rule({ status: "retired" }))).toBe("Retired");
  });

  it("falls back to the wire word for a status it does not know", () => {
    expect(statusLabel(rule({ status: "paused" }))).toBe("paused");
  });

  it("tints what is in force or decided, and leaves the rest plain", () => {
    expect(statusTone("in_force")).toBe("accent");
    expect(statusTone("decided")).toBe("accent");
    expect(statusTone("open")).toBe("waiting");
    expect(statusTone("proposed")).toBeUndefined();
    expect(statusTone("retired")).toBeUndefined();
  });

  it("tints P1 as danger and P2 as accent", () => {
    expect(priorityTone("P1")).toBe("danger");
    expect(priorityTone("P2")).toBe("accent");
    expect(priorityTone("P3")).toBeUndefined();
  });
});
