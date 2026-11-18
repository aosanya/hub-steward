import { problemOf } from "./lateRulesData";

const withRule = { id: "a-stall", name: "Market stalls", days: "14", role: "k-fin" };

describe("problemOf", () => {
  it("refuses emptying both the days and the role of a charge that already has a rule", () => {
    expect(problemOf(withRule, { days: "", role: "" })).toBe("Market stalls already has a rule: change it rather than leave it empty.");
  });

  it("lets a charge with no rule stay empty", () => {
    expect(problemOf({ ...withRule, days: "", role: "" }, { days: "", role: "" })).toBe("");
  });
});
