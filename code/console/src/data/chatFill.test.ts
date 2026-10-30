import { describe, expect, it } from "vitest";
import { applyScenarioFill, applyWorkflowFill, formTarget, goalPlansOf, scenarioFillIn, scenarioFillOf, suggestionsFillOf, workflowFillIn, workflowFillOf } from "./chatFill";
import { emptyWorkflow } from "./pages/workflowDesign";

describe("the fields a chat answer carries", () => {
  it("reads a workflow's name, description, cancel flag and steps, dropping steps without a name", () => {
    const fill = workflowFillOf({ name: " Cancel after yes ", description: "A Farmer calls off", cancel: true, steps: [{ name: "Tell", role: "Farmer" }, { role: "x" }, "junk"] });

    expect(fill).toEqual({ name: "Cancel after yes", description: "A Farmer calls off", cancel: true, steps: [{ name: "Tell", role: "Farmer", kind: "" }] });
  });

  it("reads a scenario's name, summary, workflow and actors", () => {
    const fill = scenarioFillOf({ name: "A farmer stays silent", workflow: "Group order", actors: [{ name: "Farmer 2", role: "Farmer" }, { role: "Buyer" }] });

    expect(fill).toEqual({ name: "A farmer stays silent", summary: "", workflow: "Group order", actors: [{ name: "Farmer 2", role: "Farmer" }] });
  });

  it("is rebuilt from the router state only for the form it was meant for", () => {
    const target = formTarget("h1", { kind: "form", prompt: "p", form: "scenario", fill: scenarioFillOf({ name: "S" }) });

    expect(scenarioFillIn(target.state)?.name).toBe("S");
    expect(workflowFillIn(target.state)).toBeNull();
    expect(scenarioFillIn(null)).toBeNull();
  });
});

describe("the goals a chat answer carries", () => {
  it("reads each goal's title, description and objectives, dropping the ones without a title", () => {
    const plans = goalPlansOf({
      goals: [
        { title: " Farmers buy together ", description: " One order. ", objectives: [{ title: "Gather needs" }, { description: "no title" }, "junk"] },
        { description: "no title" },
        "junk",
      ],
    });

    expect(plans).toEqual([{ title: "Farmers buy together", description: "One order.", objectives: [{ title: "Gather needs", description: "" }] }]);
  });

  it("is empty when no goal list arrives", () => {
    expect(goalPlansOf({})).toEqual([]);
  });
});

describe("where the filled form lands", () => {
  it("opens the cancel workflow form on its first tab", () => {
    const target = formTarget("h1", { kind: "form", prompt: "p", form: "workflow", fill: workflowFillOf({ name: "C", cancel: true }) });

    expect(target.to).toBe("/h/h1/workflow-edit/new/workflow?cancel=1");
  });

  it("opens the plain workflow form without the cancel mark", () => {
    const target = formTarget("h1", { kind: "form", prompt: "p", form: "workflow", fill: workflowFillOf({ name: "W" }) });

    expect(target.to).toBe("/h/h1/workflow-edit/new/workflow");
  });

  it("opens the Add a scenario form on the Test page", () => {
    const target = formTarget("h1", { kind: "form", prompt: "p", form: "scenario", fill: scenarioFillOf({ name: "S" }) });

    expect(target.to).toBe("/h/h1/test?add=1");
  });
});

describe("putting the fields on the forms", () => {
  it("fills a workflow's name, description and steps, finding each step's role by its name", () => {
    const fill = workflowFillOf({ name: "C", description: "D", steps: [{ name: "Tell", role: "farmer", kind: "notify" }, { name: "Ask", role: "Nobody", kind: "odd" }] });

    const filled = applyWorkflowFill(emptyWorkflow(), fill, [{ value: "r2", label: "Farmer" }]);

    expect(filled.name).toBe("C");
    expect(filled.description).toBe("D");
    expect(filled.steps.map((step) => [step.name, step.kind, step.roleId])).toEqual([["Tell", "notify", "r2"], ["Ask", "fill_form", ""]]);
  });

  it("finds a scenario's workflow and the roles of its actors by name, leaving out an actor whose role is unknown", () => {
    const fill = scenarioFillOf({ workflow: "group order", actors: [{ name: "Farmer 2", role: "Farmer" }, { name: "Ghost", role: "Ghost" }] });

    const filled = applyScenarioFill(fill, [{ id: "w1", name: "Group order", steps: [] }], [{ id: "r2", name: "Farmer" }]);

    expect(filled).toEqual({ workflowId: "w1", actors: [{ name: "Farmer 2", roleId: "r2" }] });
  });
});

describe("the review the chat opens", () => {
  const args = {
    summary: " Two overlap ",
    suggestions: [
      { title: "Merge O-15 into O-22", detail: "Same work", tool: "agency_update_objective", arguments: { objective_id: "o15", title: "Link farmers to buyers" } },
      { title: "Delete O-16", tool: "agency_delete_objective", arguments: { objective_id: "o16" } },
      { title: "Think about the measure" },
      { title: "Merge O-17 into O-18", tool: "agency_update_objective", arguments: { objective_id: "o18" }, then: [{ tool: "agency_delete_objective", arguments: { objective_id: "o17" } }, { tool: "agency_unknown" }] },
      { detail: "no title" },
    ],
  };

  it("keeps a suggestion's tool only when the page lets a suggestion carry it, and drops entries without a title", () => {
    const fill = suggestionsFillOf("objectives", args, ["agency_update_objective"]);

    expect(fill.summary).toBe("Two overlap");
    expect(fill.items.map((item) => [item.title, item.tool])).toEqual([["Merge O-15 into O-22", "agency_update_objective"], ["Delete O-16", ""], ["Think about the measure", ""], ["Merge O-17 into O-18", "agency_update_objective"]]);
    expect(fill.items[0].arguments).toEqual({ objective_id: "o15", title: "Link farmers to buyers" });
  });

  it("keeps the further changes a suggestion lists, only the ones the page allows", () => {
    const fill = suggestionsFillOf("objectives", args, ["agency_update_objective", "agency_delete_objective"]);

    expect(fill.items[3].then).toEqual([{ tool: "agency_delete_objective", arguments: { objective_id: "o17" } }]);
    expect(fill.items[0].then).toEqual([]);
  });
});
