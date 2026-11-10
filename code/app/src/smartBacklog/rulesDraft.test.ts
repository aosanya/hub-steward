import { blankRule, fieldSpecs, ruleComplete } from "./fields";
import { addRule, changeField, changeOperator, changeValue, countWords, draftProblem, emptyDraft, removeRule, toRuleSet } from "./rulesDraft";
import type { FieldChoices } from "./types";

const choices: FieldChoices = { tag: ["Docs", "hub-steward"], mark: ["Ready", "Blocked"], backlog: ["Software"], step: ["To do", "Doing"], priority: ["P1", "P2"] };

describe("fields", () => {
  it("lists the nine fields in the drawn order", () => {
    expect(fieldSpecs().map((spec) => spec.label)).toEqual(["Tag", "Mark", "Backlog", "Step", "Priority", "Title", "Description", "Waits on", "Last changed"]);
  });

  it("starts each rule on its first operator and a sensible value", () => {
    expect(blankRule("tag", choices)).toEqual({ field: "tag", operator: "has", value: "Docs" });
    expect(blankRule("mark", choices)).toEqual({ field: "mark", operator: "is", value: "Ready" });
    expect(blankRule("title", choices)).toEqual({ field: "title", operator: "contains", value: "" });
    expect(blankRule("waits_on", choices)).toEqual({ field: "waits_on", operator: "has_something", value: "" });
    expect(blankRule("last_changed", choices)).toEqual({ field: "last_changed", operator: "in_last", value: "30 days" });
  });

  it("needs typed words for a title and a whole number for a date", () => {
    expect(ruleComplete({ field: "title", operator: "contains", value: " " })).toBe(false);
    expect(ruleComplete({ field: "title", operator: "contains", value: "voice" })).toBe(true);
    expect(ruleComplete({ field: "last_changed", operator: "in_last", value: " days" })).toBe(false);
    expect(ruleComplete({ field: "last_changed", operator: "in_last", value: "0 days" })).toBe(false);
    expect(ruleComplete({ field: "last_changed", operator: "not_in_last", value: "2 weeks" })).toBe(true);
    expect(ruleComplete({ field: "waits_on", operator: "has_nothing", value: "" })).toBe(true);
  });
});

describe("rulesDraft", () => {
  it("adds, edits and removes rules without touching the others", () => {
    let draft = addRule(emptyDraft(), "mark", choices);
    draft = addRule(draft, "step", choices);
    draft = changeOperator(draft, 0, "is_not");
    draft = changeValue(draft, 1, "Doing");
    expect(draft.rules).toEqual([
      { field: "mark", operator: "is_not", value: "Ready" },
      { field: "step", operator: "is", value: "Doing" },
    ]);
    expect(removeRule(draft, 0).rules).toEqual([{ field: "step", operator: "is", value: "Doing" }]);
  });

  it("starts a rule again when its field changes and keeps it when the field is the same", () => {
    const draft = changeValue(addRule(emptyDraft(), "mark", choices), 0, "Blocked");
    expect(changeField(draft, 0, "mark", choices)).toBe(draft);
    expect(changeField(draft, 0, "step", choices).rules).toEqual([{ field: "step", operator: "is", value: "To do" }]);
  });

  it("names the first thing missing", () => {
    expect(draftProblem(emptyDraft())).toBe("Give the smart backlog a name.");
    expect(draftProblem({ ...emptyDraft(), name: "Ready to start" })).toBe("Add at least one rule.");
    const draft = { ...addRule({ ...emptyDraft(), name: "Quiet" }, "title", choices) };
    expect(draftProblem(draft)).toBe("Finish the Title rule.");
    expect(draftProblem(changeValue(draft, 0, "voice"))).toBe("");
  });

  it("sends trimmed values and no value for a rule that takes none", () => {
    let draft = addRule({ ...emptyDraft(), match: "any" }, "title", choices);
    draft = changeValue(draft, 0, "  voice ");
    draft = addRule(draft, "waits_on", choices);
    expect(toRuleSet(draft)).toEqual({
      match: "any",
      rules: [
        { field: "title", operator: "contains", value: "voice" },
        { field: "waits_on", operator: "has_something", value: "" },
      ],
    });
  });

  it("says how many issues match", () => {
    expect(countWords(1)).toBe("1 issue matches now");
    expect(countWords(3)).toBe("3 issues match now");
  });
});
