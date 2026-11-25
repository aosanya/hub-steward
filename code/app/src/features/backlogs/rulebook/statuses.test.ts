import { describe, expect, it } from "vitest";
import { chipOrder, firstOn, kindStatuses, ruleKinds } from "./statuses";

describe("the statuses of each kind", () => {
  it("offers four to a rule, three to a decision and three to a question", () => {
    expect(kindStatuses.rule).toEqual(["proposed", "in_force", "superseded", "retired"]);
    expect(kindStatuses.decision).toEqual(["proposed", "decided", "superseded"]);
    expect(kindStatuses.question).toEqual(["open", "answered", "dropped"]);
  });

  it("starts with In force and Proposed, Decided and Proposed, and Open", () => {
    expect(firstOn.rule).toEqual(["in_force", "proposed"]);
    expect(firstOn.decision).toEqual(["decided", "proposed"]);
    expect(firstOn.question).toEqual(["open"]);
  });

  it("turns on only statuses the kind offers", () => {
    for (const kind of ruleKinds) for (const status of firstOn[kind]) expect(kindStatuses[kind]).toContain(status);
  });

  it("names the three kinds", () => {
    expect(ruleKinds).toEqual(["rule", "decision", "question"]);
  });
});

describe("the order of the status chips", () => {
  it("lists the chips that start on first, then the others", () => {
    expect(chipOrder("rule")).toEqual(["in_force", "proposed", "superseded", "retired"]);
    expect(chipOrder("decision")).toEqual(["decided", "proposed", "superseded"]);
    expect(chipOrder("question")).toEqual(["open", "answered", "dropped"]);
  });
});
