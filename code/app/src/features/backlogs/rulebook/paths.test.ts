import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { forgetOpenAgency, openAgency } from "../../../shared/wakala/openAgency";
import { rulebookPath, rulebookRoutePath, rulePath, ruleRoutePath } from "./paths";

beforeEach(() => openAgency("hub-1"));

afterEach(() => forgetOpenAgency());

describe("the paths of the rulebook screens", () => {
  it("declares the two route patterns", () => {
    expect(rulebookRoutePath).toBe(":backlogId/rulebook");
    expect(ruleRoutePath).toBe("rule/:ruleCode");
  });

  it("builds the list of one kind on the agency base, with a repeated status", () => {
    expect(rulebookPath("b1", "rule", ["in_force", "proposed"])).toBe("/a/hub-1/backlogs/b1/rulebook?kind=rule&status=in_force&status=proposed");
  });

  it("leaves the status out when none is given", () => {
    expect(rulebookPath("b1", "question")).toBe("/a/hub-1/backlogs/b1/rulebook?kind=question");
    expect(rulebookPath("all", "decision", [])).toBe("/a/hub-1/backlogs/all/rulebook?kind=decision");
  });

  it("encodes the backlog id", () => {
    expect(rulebookPath("a b", "rule")).toBe("/a/hub-1/backlogs/a%20b/rulebook?kind=rule");
  });

  it("writes the search text after the statuses, and leaves a blank one out", () => {
    expect(rulebookPath("b1", "rule", ["in_force"], "font size")).toBe("/a/hub-1/backlogs/b1/rulebook?kind=rule&status=in_force&q=font+size");
    expect(rulebookPath("b1", "rule", [], "  ")).toBe("/a/hub-1/backlogs/b1/rulebook?kind=rule");
  });

  it("builds the path of one record", () => {
    expect(rulePath("R-2")).toBe("/a/hub-1/backlogs/rule/R-2");
    expect(rulePath("D 3")).toBe("/a/hub-1/backlogs/rule/D%203");
  });
});
