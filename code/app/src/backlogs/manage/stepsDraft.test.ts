import {
  addStep,
  canMoveDown,
  canMoveUp,
  canRemove,
  draftProblem,
  heldWords,
  moveDown,
  moveUp,
  removeStep,
  renameStep,
  savedStep,
} from "./stepsDraft";

const three = () => [savedStep("a", "To do", 2), savedStep("b", "Doing", 0), savedStep("c", "Done", 0)];

const names = (steps: ReturnType<typeof three>) => steps.map((step) => step.name);

describe("steps draft", () => {
  it("moves a step up and down and stops at the ends", () => {
    expect(names(moveDown(three(), 0))).toEqual(["Doing", "To do", "Done"]);
    expect(names(moveUp(three(), 2))).toEqual(["To do", "Done", "Doing"]);
    expect(names(moveUp(three(), 0))).toEqual(["To do", "Doing", "Done"]);
    expect(names(moveDown(three(), 2))).toEqual(["To do", "Doing", "Done"]);
    expect(canMoveUp(three(), 0)).toBe(false);
    expect(canMoveDown(three(), 2)).toBe(false);
    expect(canMoveUp(three(), 1)).toBe(true);
    expect(canMoveDown(three(), 1)).toBe(true);
  });

  it("refuses to remove a step that holds issues", () => {
    expect(canRemove(three()[0])).toBe(false);
    expect(names(removeStep(three(), 0))).toEqual(["To do", "Doing", "Done"]);
    expect(names(removeStep(three(), 1))).toEqual(["To do", "Done"]);
  });

  it("adds a step at the end with no id and renames in place", () => {
    const added = addStep(three(), "Review");
    expect(names(added)).toEqual(["To do", "Doing", "Done", "Review"]);
    expect(added[3].id).toBe("");
    expect(new Set(added.map((step) => step.key)).size).toBe(4);
    expect(names(renameStep(three(), 1, "Working"))).toEqual(["To do", "Working", "Done"]);
  });

  it("says how many issues a step holds", () => {
    expect(heldWords(0)).toBe("No issues");
    expect(heldWords(1)).toBe("1 issue");
    expect(heldWords(5)).toBe("5 issues");
  });

  it("names the first problem with a draft", () => {
    expect(draftProblem("", three())).toBe("Give the backlog a name.");
    expect(draftProblem("Support", [])).toBe("Add at least one step.");
    expect(draftProblem("Support", renameStep(three(), 1, " "))).toBe("Every step needs a name.");
    expect(draftProblem("Support", renameStep(three(), 1, "to do"))).toBe("Two steps have the same name.");
    expect(draftProblem("Support", three())).toBe("");
  });
});
