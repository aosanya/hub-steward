import { describe, expect, it } from "vitest";
import type { EarlierStep } from "./api";
import { amendmentsOf, editKey } from "./amend";

const earlier: EarlierStep[] = [
  {
    stepTitle: "Report a referral",
    roleName: "Volunteer",
    answers: [
      { prompt: "Reason", answer: "Needs a clinic check" },
      { prompt: "Minutes to the clinic", answer: "25" },
    ],
  },
  {
    stepTitle: "Check the family",
    roleName: "Nurse",
    answers: [{ prompt: "Household size", answer: "4" }],
  },
];

describe("naming an edit by its place in the earlier work", () => {
  it("joins the step index and the answer index", () => {
    expect(editKey(0, 1)).toBe("0:1");
    expect(editKey(2, 0)).toBe("2:0");
  });
});

describe("turning edits into amendments", () => {
  it("gives nothing when nothing was edited", () => {
    expect(amendmentsOf(earlier, {})).toEqual({});
  });

  it("describes a changed answer as from and to", () => {
    const edits = { [editKey(0, 0)]: { text: "Needs a dentist", struck: false } };
    expect(amendmentsOf(earlier, edits)).toEqual({
      "Changed: Report a referral: Reason": 'Changed from "Needs a clinic check" to "Needs a dentist"',
    });
  });

  it("describes a struck answer by what was struck", () => {
    const edits = { [editKey(0, 1)]: { text: "25", struck: true } };
    expect(amendmentsOf(earlier, edits)).toEqual({
      "Changed: Report a referral: Minutes to the clinic": 'Struck out "25"',
    });
  });

  it("gives nothing for an edit whose text is the original", () => {
    const edits = { [editKey(0, 0)]: { text: "Needs a clinic check", struck: false } };
    expect(amendmentsOf(earlier, edits)).toEqual({});
  });

  it("ignores surrounding spaces when comparing with the original", () => {
    const edits = { [editKey(0, 1)]: { text: "  25  ", struck: false } };
    expect(amendmentsOf(earlier, edits)).toEqual({});
  });

  it("trims the new text it reports", () => {
    const edits = { [editKey(0, 1)]: { text: "  30  ", struck: false } };
    expect(amendmentsOf(earlier, edits)).toEqual({
      "Changed: Report a referral: Minutes to the clinic": 'Changed from "25" to "30"',
    });
  });

  it("counts an emptied answer as a change to nothing", () => {
    const edits = { [editKey(1, 0)]: { text: "", struck: false } };
    expect(amendmentsOf(earlier, edits)).toEqual({
      "Changed: Check the family: Household size": 'Changed from "4" to ""',
    });
  });

  it("names each step by its own title", () => {
    const edits = {
      [editKey(0, 0)]: { text: "Needs a dentist", struck: false },
      [editKey(1, 0)]: { text: "5", struck: false },
    };
    expect(Object.keys(amendmentsOf(earlier, edits)).sort()).toEqual([
      "Changed: Check the family: Household size",
      "Changed: Report a referral: Reason",
    ]);
  });

  it("gives nothing for answers that have no edit", () => {
    const edits = { [editKey(0, 0)]: { text: "Needs a dentist", struck: false } };
    expect(Object.keys(amendmentsOf(earlier, edits))).toHaveLength(1);
  });

  it("reports a struck answer once, as struck", () => {
    const edits = { [editKey(0, 0)]: { text: "Something else", struck: true } };
    const found = amendmentsOf(earlier, edits);
    expect(found["Changed: Report a referral: Reason"]).toContain('Struck out "Needs a clinic check"');
  });
});
