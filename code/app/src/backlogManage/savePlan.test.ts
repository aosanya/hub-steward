import { openAgency, forgetOpenAgency } from "../agency/open";
import { McpError } from "../wakala/mcp";
import { allowedIn, managePermission, refusalText } from "./api";
import { addBacklogPath, editBacklogPath } from "./paths";
import { savePlan } from "./savePlan";
import { newStep, savedStep } from "./stepsDraft";
import { ManageRefused, refusalWords } from "./types";

const original = {
  id: "software",
  name: "Software",
  steps: [savedStep("a", "To do", 2), savedStep("b", "Doing", 0), savedStep("c", "Done", 0)],
};

const keep = (id: string, name: string) => savedStep(id, name, 0);

describe("planning a save", () => {
  it("plans nothing to remove or rename when the steps are as they were", () => {
    const plan = savePlan(original, [keep("a", "To do"), keep("b", "Doing"), keep("c", "Done")]);
    expect(plan).toMatchObject({ problem: "", removed: [], renames: [], replacesAll: false });
  });

  it("removes the saved steps the draft leaves out", () => {
    const plan = savePlan(original, [keep("a", "To do"), keep("c", "Done")]);
    expect(plan.removed.map((step) => step.id)).toEqual(["b"]);
  });

  it("renames a kept step to its trimmed new name", () => {
    const plan = savePlan(original, [keep("a", "To do"), keep("b", "  Working "), keep("c", "Done")]);
    expect(plan.renames).toEqual([{ id: "b", from: "Doing", to: "Working" }]);
  });

  it("orders renames so that no name is ever used twice: B to C first, then A to B", () => {
    const plan = savePlan(original, [keep("a", "Doing"), keep("b", "Done"), keep("c", "Finished")]);
    expect(plan.problem).toBe("");
    expect(plan.renames.map((one) => `${one.from}>${one.to}`)).toEqual(["Done>Finished", "Doing>Done", "To do>Doing"]);
  });

  it("refuses two steps that swap names, with a plain way out, and plans nothing", () => {
    const plan = savePlan(original, [keep("a", "Doing"), keep("b", "To do"), keep("c", "Done")]);
    expect(plan.problem).toBe("Two steps would swap names. Rename one of them to another name first, save, then rename the other.");
    expect(plan.renames).toEqual([]);
    expect(plan.removed).toEqual([]);
    expect(plan.draft).toEqual([]);
  });

  it("keeps a removed step when a new step is added under its name", () => {
    const added = newStep("Doing");
    const plan = savePlan(original, [keep("a", "To do"), added, keep("c", "Done")]);
    expect(plan.removed).toEqual([]);
    expect(plan.draft.map((step) => step.id)).toEqual(["a", "b", "c"]);
  });

  it("gives two new steps of the same removed name only one old step", () => {
    const plan = savePlan(original, [keep("a", "To do"), newStep("Doing"), newStep("Doing"), keep("c", "Done")]);
    expect(plan.draft.map((step) => step.id)).toEqual(["a", "b", "", "c"]);
  });

  it("matches a new step's name ignoring spaces around it", () => {
    const plan = savePlan(original, [keep("a", "To do"), newStep("  Doing "), keep("c", "Done")]);
    expect(plan.draft[1].id).toBe("b");
  });

  it("marks a save that keeps no old step as replacing every step", () => {
    const plan = savePlan(original, [newStep("New"), newStep("Closed")]);
    expect(plan.replacesAll).toBe(true);
    expect(plan.removed.map((step) => step.id)).toEqual(["a", "b", "c"]);
  });

  it("says a step was changed by someone else when the backlog no longer has it", () => {
    const plan = savePlan(original, [keep("a", "To do"), keep("z", "Review")]);
    expect(plan.problem).toBe("Review was changed by someone else. Open the backlog again.");
    expect(plan.draft).toEqual([]);
  });
});

describe("what the manage screens say and where they go", () => {
  beforeEach(() => openAgency("hub-steward-swe"));

  afterEach(() => forgetOpenAgency());

  it("opens Add a backlog and Edit under the agency's backlogs, encoding the id", () => {
    expect(addBacklogPath()).toBe("/a/hub-steward-swe/backlogs/new");
    expect(editBacklogPath("a b/c")).toBe("/a/hub-steward-swe/backlogs/a%20b%2Fc/edit");
  });

  it("shows a refusal's own words, else the fallback", () => {
    expect(refusalWords(new ManageRefused("A step with that name exists."), "Could not save.")).toBe("A step with that name exists.");
    expect(refusalWords(new ManageRefused(""), "Could not save.")).toBe("Could not save.");
    expect(refusalWords(new Error("boom"), "Could not save.")).toBe("Could not save.");
    expect(refusalWords("boom", "Could not save.")).toBe("Could not save.");
  });

  it("allows managing only with the backlog.manage permission in a list of permissions", () => {
    expect(managePermission).toBe("backlog.manage");
    expect(allowedIn({ permissions: ["ai.chat", "backlog.manage"] })).toBe(true);
    expect(allowedIn({ permissions: ["ai.chat"] })).toBe(false);
    expect(allowedIn({ permissions: "backlog.manage" })).toBe(false);
    expect(allowedIn(undefined)).toBe(false);
  });

  it("keeps the words after the first colon of a refusal and none for an error that is not the hub's", () => {
    expect(refusalText(new McpError("taskmanager_backlog_delete: backlog holds issues"))).toBe("backlog holds issues");
    expect(refusalText(new McpError("no colon here"))).toBe("no colon here");
    expect(refusalText(new Error("taskmanager_x: nope"))).toBe("");
  });
});
