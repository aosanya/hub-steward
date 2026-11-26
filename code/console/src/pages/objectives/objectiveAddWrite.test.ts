import { beforeEach, describe, expect, it, vi } from "vitest";
import { callTool } from "../../wakala/mcp";
import { goalsPage } from "../../data/pages/goals";
import { addObjective } from "./objectiveAddWrite";
import { objectivesPage } from "./objectivesModule";

vi.mock("../../wakala/mcp");

const callsOf = (tool: string) =>
  vi
    .mocked(callTool)
    .mock.calls.filter((c) => c[1] === tool)
    .map((c) => c[2]);

const toolsCalled = () => vi.mocked(callTool).mock.calls.map((c) => c[1]);

const answerWith = (objectives: Record<string, unknown>[] = []) =>
  vi.mocked(callTool).mockImplementation((async (
    _hubId: string,
    tool: string,
    args: Record<string, unknown> = {},
  ) => {
    if (tool === "agency_list_drafts")
      return { items: [{ id: "d1", status: "open" }] };
    if (tool === "agency_create_objective") {
      const made = { id: "o1", code: "O-1", ...args };
      objectives.push(made);
      return made;
    }
    if (tool === "agency_list_objectives")
      return {
        items: objectives.filter((objective) => objective.draft_id === args.draft_id),
      };
    return {};
  }) as never);

beforeEach(() => {
  vi.resetAllMocks();
  answerWith();
});

describe("adding an objective", () => {
  const values = {
    goal_id: "g1",
    title: " Sell ",
    workflow_id: "w1",
    workflow_name: "Group order",
    description: " d ",
  };

  it("writes the objective to the working draft and links it to the workflow that serves it, never asking for approval", async () => {
    expect(await addObjective("h", values)).toBe("done");
    expect(toolsCalled()).not.toContain("agency_propose_write");
    expect(callsOf("agency_create_objective")).toEqual([
      { draft_id: "d1", goal_id: "g1", title: "Sell", description: "d" },
    ]);
    expect(callsOf("agency_link_workflow_objective")).toEqual([
      { draft_id: "d1", objective_id: "o1", workflow_id: "w1" },
    ]);
    expect(callsOf("agency_set_measure")).toEqual([]);
  });

  it("sets the measure on the new objective and never a role", async () => {
    await addObjective("h", { ...values, measure: "Yield", target: "10" });
    expect(callsOf("agency_set_measure")).toEqual([
      { objective_id: "o1", name: "Yield", target: "10" },
    ]);
    expect(toolsCalled()).not.toContain("agency_set_raci");
  });

  it("shows the added objective under its goal at once", async () => {
    const objectives: Record<string, unknown>[] = [];
    answerWith(objectives);

    expect(await goalsPage.rows("h", { goal: "g1" })).toEqual([]);
    await addObjective("h", values);

    expect(await goalsPage.rows("h", { goal: "g1" })).toEqual([
      { id: "o1", code: "O-1", title: "Sell", goal_id: "g1" },
    ]);
  });

  it("fails when the objective is not given an id", async () => {
    vi.mocked(callTool).mockResolvedValue({} as never);
    await expect(addObjective("h", values)).rejects.toThrow(
      "the objective was not given an id",
    );
  });

  it.each([
    ["a goal", { ...values, goal_id: "" }, "goal is required"],
    ["a title", { ...values, title: " " }, "title is required"],
    ["a workflow", { ...values, workflow_id: " " }, "workflow is required"],
    [
      "a target for the measure",
      { ...values, measure: "Yield" },
      "target is required",
    ],
  ])("refuses a missing %s", async (_, given, message) => {
    await expect(addObjective("h", given)).rejects.toThrow(message);
    expect(callTool).not.toHaveBeenCalled();
  });

  it("is the action the Objectives page runs for Add an objective", () => {
    expect(objectivesPage.actions?.add).toBe(addObjective);
    expect(objectivesPage.spec.tools).toContain(
      "agency_link_workflow_objective",
    );
    expect(objectivesPage.spec.tools).not.toContain("agency_set_raci");
  });
});
