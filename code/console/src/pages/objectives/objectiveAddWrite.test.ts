import { beforeEach, describe, expect, it, vi } from "vitest";
import { callTool } from "../../wakala/mcp";
import { addObjective } from "./objectiveAddWrite";
import { objectivesPage } from "./objectivesModule";

vi.mock("../../wakala/mcp");

const written = () => {
  const call = vi
    .mocked(callTool)
    .mock.calls.find((c) => c[1] === "agency_propose_write")?.[2] as {
    kind: string;
    summary: string;
    payload: string;
  };
  return {
    kind: call.kind,
    summary: call.summary,
    payload: JSON.parse(call.payload),
  };
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(callTool).mockResolvedValue({} as never);
});

describe("adding an objective", () => {
  const values = {
    goal_id: "g1",
    title: " Sell ",
    workflow_id: "w1",
    workflow_name: "Group order",
    description: " d ",
  };

  it("proposes one write that links the objective to the workflow that serves it", async () => {
    expect(await addObjective("h", values)).toBe("accepted");
    expect(written()).toEqual({
      kind: "agency_create_objective",
      summary: "Add the objective Sell, served by Group order",
      payload: {
        goal_id: "g1",
        title: "Sell",
        description: "d",
        workflow: { tool: "agency_link_workflow_objective", workflow_id: "w1" },
      },
    });
  });

  it("carries the measure in the same write and never a role", async () => {
    await addObjective("h", { ...values, measure: "Yield", target: "10" });
    expect(written().payload.measure).toEqual({
      tool: "agency_set_measure",
      name: "Yield",
      target: "10",
    });
    expect(JSON.stringify(written())).not.toContain("agency_set_raci");
    expect(written().payload).not.toHaveProperty("raci");
  });

  it("names the workflow by its id when it has no name", async () => {
    await addObjective("h", { ...values, workflow_name: "" });
    expect(written().summary).toContain("served by w1");
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
