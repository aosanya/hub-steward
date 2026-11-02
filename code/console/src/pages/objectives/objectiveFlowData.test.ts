import { beforeEach, describe, expect, it, vi } from "vitest";
import { callTool } from "../../wakala/mcp";
import { loadObjectiveFlow } from "./objectiveFlowData";

vi.mock("../../wakala/mcp");

const answers = (more: Record<string, unknown> = {}) => ({
  agency_list_drafts: { items: [] },
  agency_list_objectives: [
    { id: "o1", code: "O-1" },
    { id: "o2", code: "O-2" },
  ],
  agency_list_workflow_objectives: [
    { workflow_id: "w1", objective_id: "o1" },
    { workflow_id: "w1", objective_id: "o2" },
    { workflow_id: "w2", objective_id: "o2" },
  ],
  agency_list_workflows: [
    { id: "w1", code: "W-1", name: "Group order" },
    { id: "w2", code: "W-2", name: "Cancel" },
  ],
  agency_list_work_items: [
    {
      id: "s2",
      code: "WI-2",
      title: "Second",
      workflow_id: "w1",
      ordinality: 2,
    },
    {
      id: "s1",
      code: "WI-1",
      title: "First",
      workflow_id: "w1",
      ordinality: 1,
    },
    {
      id: "s3",
      code: "WI-3",
      title: "Other",
      workflow_id: "w2",
      ordinality: 1,
    },
  ],
  agency_list_roles: [
    { id: "r1", name: "Coordinator", kind: "human" },
    { id: "r2", name: "Agent", kind: "ai" },
  ],
  agency_list_role_assignments_for_work_item: (args: {
    work_item_id: string;
  }) =>
    ({
      s1: [
        { role_id: "r1", label: "Accountable" },
        { role_id: "r1", label: "responsible" },
        { role_id: "r2", label: "owner" },
        { role_id: "r-gone", label: "informed" },
      ],
      s2: [],
      s3: [{ role_id: "r2", label: "consulted" }],
    })[args.work_item_id],
  ...more,
});

const answer = (more: Record<string, unknown> = {}) => {
  const replies = answers(more) as Record<string, unknown>;
  vi.mocked(callTool).mockImplementation(async (_hub, tool, args) => {
    const reply = replies[tool];
    if (reply === undefined) throw new Error("unexpected tool " + tool);
    return (typeof reply === "function" ? reply(args) : reply) as never;
  });
};

const argsOf = (tool: string) =>
  vi
    .mocked(callTool)
    .mock.calls.filter((call) => call[1] === tool)
    .map((call) => call[2]);

beforeEach(() => {
  vi.mocked(callTool).mockReset();
});

describe("the workflows and steps of an objective", () => {
  it("puts the steps of each workflow in their listed order and names every objective a workflow serves", async () => {
    answer();
    const flow = await loadObjectiveFlow("h", "o2");
    expect(
      flow.workflows.map((workflow) => workflow.objectives.map((o) => o.code)),
    ).toEqual([["O-1", "O-2"], ["O-2"]]);
    expect(flow.steps.map((step) => step.code)).toEqual([
      "WI-1",
      "WI-2",
      "WI-3",
    ]);
    expect(flow.steps[2].workflow).toEqual({
      id: "w2",
      code: "W-2",
      name: "Cancel",
    });
  });

  it("gives each role once with its labels in the order Responsible, Accountable, Consulted, Informed, whatever case they come in", async () => {
    answer();
    const flow = await loadObjectiveFlow("h", "o1");
    expect(flow.steps[0].roles).toEqual([
      {
        roleId: "r1",
        name: "Coordinator",
        ai: false,
        labels: ["responsible", "accountable"],
      },
    ]);
  });

  it("leaves out a label that is none of the four and a role the role list no longer holds", async () => {
    answer();
    const flow = await loadObjectiveFlow("h", "o1");
    expect(flow.steps[0].roles.map((role) => role.roleId)).toEqual(["r1"]);
  });

  it("tells an agent from a person", async () => {
    answer();
    const flow = await loadObjectiveFlow("h", "o2");
    expect(flow.steps[2].roles).toEqual([
      { roleId: "r2", name: "Agent", ai: true, labels: ["consulted"] },
    ]);
  });

  it("has no steps when no workflow serves the objective", async () => {
    answer();
    expect(await loadObjectiveFlow("h", "o9")).toEqual({
      workflows: [],
      steps: [],
    });
    expect(argsOf("agency_list_role_assignments_for_work_item")).toEqual([]);
  });

  it("reads every list from the draft the query names", async () => {
    answer();
    await loadObjectiveFlow("h", "o1", { draft_id: "d1" });
    for (const tool of [
      "agency_list_workflow_objectives",
      "agency_list_workflows",
      "agency_list_work_items",
      "agency_list_roles",
    ])
      expect(argsOf(tool)).toEqual([{ draft_id: "d1" }]);
    expect(argsOf("agency_list_role_assignments_for_work_item")[0]).toEqual({
      draft_id: "d1",
      work_item_id: "s1",
    });
  });

  it("fails when the workflows cannot be read", async () => {
    answer({
      agency_list_workflows: () => {
        throw new Error("down");
      },
    });
    await expect(loadObjectiveFlow("h", "o1")).rejects.toThrow("down");
  });
});
