import { describe, expect, it } from "vitest";
import type { RouteDraft, RuleDraft, StepDraft } from "../../data/pages/workflowDesign";
import { arrivalsAt } from "./reachedFrom";

const step = (key: string, over: Partial<StepDraft> = {}): StepDraft => ({
  key,
  id: "",
  name: key,
  description: "",
  kind: "fill_form",
  roleId: "",
  recipientRoleId: "",
  sentKey: "",
  runWorkflowId: "",
  formName: "",
  questions: [],
  routes: [],
  otherwiseKey: "",
  prompt: "",
  timeLimit: "",
  cancelWorkflowId: "",
  ...over,
});

const rule = (value: string, operator: RuleDraft["operator"] = "is"): RuleDraft => ({ question: "q", operator, value });

const route = (goTo: string, rules: RuleDraft[]): RouteDraft => ({ match: "all", rules, goTo });

const router = (key: string, routes: RouteDraft[], otherwiseKey = ""): StepDraft => step(key, { kind: "route", routes, otherwiseKey });

describe("how a step is reached", () => {
  it("has no arrival for the first step", () => {
    expect(arrivalsAt([step("a"), step("b")], 0)).toEqual([]);
  });

  it("is reached in order from a plain step before it", () => {
    const steps = [step("a"), step("b")];
    expect(arrivalsAt(steps, 1)).toEqual([{ from: steps[0], via: "viaOrder" }]);
  });

  it("is reached by falling through a route with no otherwise", () => {
    const steps = [router("r", []), step("b")];
    expect(arrivalsAt(steps, 1)).toEqual([{ from: steps[0], via: "viaOtherwise" }]);
  });

  it("is not reached in order from a route that names an otherwise elsewhere", () => {
    const steps = [router("r", [], "z"), step("b"), step("z")];
    expect(arrivalsAt(steps, 1)).toEqual([]);
    expect(arrivalsAt(steps, 2)).toEqual([
      { from: steps[1], via: "viaOrder" },
      { from: steps[0], via: "viaOtherwise" },
    ]);
  });

  it("names a single yes or no rule and any other rule as a match", () => {
    const steps = [
      router("r", [route("t", [rule("yes")]), route("t", [rule("no")]), route("t", [rule("maybe")]), route("t", [rule("yes", "is_not")]), route("t", [rule("yes"), rule("no")]), route("t", [])], "x"),
      step("x"),
      step("t"),
    ];
    expect(arrivalsAt(steps, 2).map((a) => a.via)).toEqual(["viaOrder", "viaYes", "viaNo", "viaMatch", "viaMatch", "viaMatch", "viaMatch"]);
  });

  it("lists every route and otherwise that lead to it, after the in-order arrival", () => {
    const steps = [step("a"), router("r1", [route("t", [rule("yes")])], "t"), step("t")];
    expect(arrivalsAt(steps, 2).map((a) => [a.from.key, a.via])).toEqual([
      ["r1", "viaYes"],
      ["r1", "viaOtherwise"],
    ]);
  });

  it("ignores a route that points back at itself", () => {
    const steps = [router("r", [route("r", [rule("yes")])], "r")];
    expect(arrivalsAt(steps, 0)).toEqual([]);
  });

  it("only counts steps that are routes", () => {
    const steps = [step("a", { routes: [route("t", [rule("yes")])], otherwiseKey: "t" }), step("t")];
    expect(arrivalsAt(steps, 1).map((a) => a.via)).toEqual(["viaOrder"]);
  });
});
