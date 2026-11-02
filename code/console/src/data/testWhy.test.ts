import { describe, expect, it } from "vitest";
import { testRunOf } from "./testRun";
import { causeAsked, firstFailed, whyOf } from "./testWhy";

const run = testRunOf({
  id: "r1",
  scenario_id: "s1",
  result: "failed",
  steps: [
    { step: "Ask", actor: "Farmer 1", did: "Asked", rules: [{ code: "RU-7", held: true }] },
    {
      step: "Ask again",
      actor: "Suppliers' agent",
      did: "Asked twice",
      failed: true,
      expected: "One message",
      found: "A second ask",
      rules: [
        { code: "RU-2", held: true },
        { code: "RU-7", held: false },
      ],
    },
  ],
});

const rules = [
  { code: "RU-2", text: "Two" },
  { code: "RU-7", text: "Seven" },
];

describe("reading why a step failed", () => {
  it("finds the first failed step", () => {
    expect(firstFailed(run)).toBe(1);
  });

  it("names the step by its number, the rule that did not hold with its text, and what was expected and found", () => {
    expect(whyOf(run, 1, rules)).toEqual({
      number: 2,
      step: "Ask again",
      actor: "Suppliers' agent",
      did: "Asked twice",
      ruleCode: "RU-7",
      ruleText: "Seven",
      expected: "One message",
      found: "A second ask",
    });
  });

  it("answers nothing for a step that did not fail", () => {
    expect(whyOf(run, 0, rules)).toBeNull();
    expect(whyOf(run, 9, rules)).toBeNull();
  });

  it("asks the model about the rule only when a rule broke", () => {
    const answer = whyOf(run, 1, rules)!;
    expect(causeAsked(answer)).toContain("Rule RU-7: Seven");
    expect(causeAsked({ ...answer, ruleCode: "", ruleText: "" })).not.toContain("Rule ");
  });
});
