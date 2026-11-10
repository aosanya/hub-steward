import { beforeEach, describe, expect, it, vi } from "vitest";
import { draftScope } from "../../data/draft";
import { callTool } from "../../wakala/mcp";
import { roleDirectory, rolesOnStep } from "./objectiveFlowData";
import { loadStepDetail } from "./stepDetail";

vi.mock("../../wakala/mcp");
vi.mock("../../data/draft");
vi.mock("./objectiveFlowData");

const answers = (replies: Record<string, unknown>) =>
  vi.mocked(callTool).mockImplementation(async (_hub, tool) => (replies[tool] ?? {}) as never);

const asked = (tool: string) => vi.mocked(callTool).mock.calls.filter((call) => call[1] === tool);

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(draftScope).mockResolvedValue({ draft_id: "d1" });
  vi.mocked(roleDirectory).mockResolvedValue(new Map());
  vi.mocked(rolesOnStep).mockResolvedValue([{ roleId: "r1", name: "Clerk", ai: false, labels: ["responsible"] }] as never);
});

describe("reading one step of an objective", () => {
  it("names the step, its workflow, the objectives that workflow serves, and the roles on it", async () => {
    answers({
      agency_get_work_item: { id: "s1", code: "S-1", title: "Check the form", workflow_id: "w1" },
      agency_get_workflow: { code: "W-1", name: "Register a member" },
      agency_list_workflow_objectives: { items: [{ objective_id: "o1" }, { objective_id: "o3" }] },
      agency_list_objectives: { items: [{ id: "o1", code: "O-1" }, { id: "o2", code: "O-2" }, { id: "o3", code: "O-3" }] },
    });

    const detail = await loadStepDetail("h1", "s1");

    expect(detail).toEqual({
      id: "s1",
      code: "S-1",
      name: "Check the form",
      workflow: { id: "w1", code: "W-1", name: "Register a member" },
      objectives: [{ id: "o1", code: "O-1" }, { id: "o3", code: "O-3" }],
      roles: [{ roleId: "r1", name: "Clerk", ai: false, labels: ["responsible"] }],
    });
  });

  it("reads the objectives and the workflow link inside the draft the page is on", async () => {
    answers({ agency_get_work_item: { id: "s1", workflow_id: "w1" } });

    await loadStepDetail("h1", "s1", { draft_id: "d9" });

    expect(draftScope).toHaveBeenCalledWith("h1", { draft_id: "d9" });
    expect(asked("agency_list_workflow_objectives")[0][2]).toEqual({ draft_id: "d1", workflow_id: "w1" });
    expect(asked("agency_list_objectives")[0][2]).toEqual({ draft_id: "d1" });
    expect(rolesOnStep).toHaveBeenCalledWith("h1", { draft_id: "d1" }, "s1", expect.any(Map));
  });

  it("has no workflow and no objectives when the step belongs to none, and asks for neither", async () => {
    answers({ agency_get_work_item: { id: "s1", code: "S-1", title: "Loose step" } });

    const detail = await loadStepDetail("h1", "s1");

    expect(detail.workflow).toBeNull();
    expect(detail.objectives).toEqual([]);
    expect(asked("agency_get_workflow")).toHaveLength(0);
    expect(asked("agency_list_workflow_objectives")).toHaveLength(0);
  });

  it("falls back to the id it was opened with when the hub's answer has none", async () => {
    answers({ agency_get_work_item: { title: "No id" } });

    expect((await loadStepDetail("h1", "s7")).id).toBe("s7");
  });

  it("lists no objective when the workflow serves none", async () => {
    answers({
      agency_get_work_item: { id: "s1", workflow_id: "w1" },
      agency_get_workflow: { code: "W-1", name: "Register" },
      agency_list_workflow_objectives: { items: [] },
      agency_list_objectives: { items: [{ id: "o1", code: "O-1" }] },
    });

    expect((await loadStepDetail("h1", "s1")).objectives).toEqual([]);
  });

  it("fails when the step cannot be read", async () => {
    vi.mocked(callTool).mockRejectedValue(new Error("work item not found"));

    await expect(loadStepDetail("h1", "gone")).rejects.toThrow("work item not found");
  });
});
