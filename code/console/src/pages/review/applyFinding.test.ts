import { beforeEach, describe, expect, it, vi } from "vitest";

const mcp = vi.hoisted(() => ({ callTool: vi.fn(), listTools: vi.fn() }));
const api = vi.hoisted(() => ({ setFindingStatus: vi.fn() }));
const design = vi.hoisted(() => ({ workingDraft: vi.fn() }));

vi.mock("../../wakala/mcp", () => mcp);
vi.mock("../../data/reviewApi", () => api);
vi.mock("../../data/pages/workflowDesign", () => design);

import type { Finding } from "../../data/reviewApi";
import { applyFinding, questionAboutFinding } from "./applyFinding";

const finding = (patch: Partial<Finding> = {}): Finding => ({
  id: "f1",
  area_id: "a1",
  title: "Add a goal",
  detail: "Members need one",
  tool: "agency_create_goal",
  arguments: { name: "Feed more" },
  then: [{ tool: "agency_link_goal", arguments: { goal: "Feed more" } }],
  status: "open",
  fate: "new",
  fate_reason: "",
  carried_from_id: "",
  comments: [],
  ...patch,
});

const withDraft = { properties: { draft_id: {} } };
const withoutDraft = { properties: {} };

const tools = [
  { name: "agency_create_goal", description: "", inputSchema: withDraft },
  { name: "agency_link_goal", description: "", inputSchema: withoutDraft },
  { name: "agency_delete_risk", description: "", inputSchema: withDraft },
  ...[
    "agency_start_review",
    "agency_run_review",
    "agency_set_finding_status",
    "agency_comment_finding",
    "agency_record_review_area",
    "agency_review_input",
    "agency_run_scenario",
    "agency_run_scenarios",
    "agency_delete_workflow",
    "agency_delete_goal",
    "agency_delete_role",
    "actor_create_group",
    "ai_create_role",
  ].map((name) => ({ name, description: "", inputSchema: withDraft })),
];

beforeEach(() => {
  vi.resetAllMocks();
  mcp.listTools.mockResolvedValue(tools);
  mcp.callTool.mockResolvedValue({});
  design.workingDraft.mockResolvedValue("draft-9");
  api.setFindingStatus.mockImplementation(async (_hub: string, id: string) => finding({ id, status: "applied" }));
});

describe("applyFinding", () => {
  it("runs the tool, then the follow-up step, then marks the finding applied", async () => {
    const result = await applyFinding("hub-1", finding());
    expect(mcp.callTool.mock.calls.map((call) => call[1])).toEqual(["agency_create_goal", "agency_link_goal"]);
    expect(api.setFindingStatus).toHaveBeenCalledWith("hub-1", "f1", "applied");
    expect(result.status).toBe("applied");
    expect(mcp.callTool.mock.invocationCallOrder[1]).toBeLessThan(api.setFindingStatus.mock.invocationCallOrder[0]);
  });

  it("adds the working draft only to tools that take one and always the hub as instance_id", async () => {
    await applyFinding("hub-1", finding());
    expect(mcp.callTool).toHaveBeenNthCalledWith(1, "hub-1", "agency_create_goal", {
      name: "Feed more",
      draft_id: "draft-9",
      instance_id: "hub-1",
    });
    expect(mcp.callTool).toHaveBeenNthCalledWith(2, "hub-1", "agency_link_goal", {
      goal: "Feed more",
      instance_id: "hub-1",
    });
  });

  it.each([
    "agency_start_review",
    "agency_run_review",
    "agency_set_finding_status",
    "agency_comment_finding",
    "agency_record_review_area",
    "agency_review_input",
    "agency_run_scenario",
    "agency_run_scenarios",
    "agency_delete_workflow",
    "agency_delete_goal",
    "agency_delete_role",
    "actor_create_group",
    "ai_create_role",
  ])("refuses %s without running anything", async (tool) => {
    await expect(applyFinding("hub-1", finding({ tool, then: [] }))).rejects.toThrow(
      "this suggestion has no change to apply",
    );
    expect(mcp.callTool).not.toHaveBeenCalled();
    expect(api.setFindingStatus).not.toHaveBeenCalled();
  });

  it("allows a smaller delete such as a risk", async () => {
    await applyFinding("hub-1", finding({ tool: "agency_delete_risk", then: [] }));
    expect(mcp.callTool).toHaveBeenCalledTimes(1);
  });

  it("refuses a denied follow-up step before the first step runs", async () => {
    const denied = finding({ then: [{ tool: "agency_delete_role", arguments: {} }] });
    await expect(applyFinding("hub-1", denied)).rejects.toThrow("this suggestion has no change to apply");
    expect(mcp.callTool).not.toHaveBeenCalled();
  });

  it("refuses a finding with an empty tool", async () => {
    await expect(applyFinding("hub-1", finding({ tool: "", then: [] }))).rejects.toThrow(
      "this suggestion has no change to apply",
    );
    expect(mcp.callTool).not.toHaveBeenCalled();
    expect(api.setFindingStatus).not.toHaveBeenCalled();
  });

  it("does not mark the finding applied when the second step fails, and does not rerun the first", async () => {
    mcp.callTool.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error("the goal is already linked"));
    await expect(applyFinding("hub-1", finding())).rejects.toThrow("the goal is already linked");
    expect(mcp.callTool).toHaveBeenCalledTimes(2);
    expect(api.setFindingStatus).not.toHaveBeenCalled();
  });

  it("names a tool the server does not offer", async () => {
    mcp.listTools.mockResolvedValue([]);
    await expect(applyFinding("hub-1", finding())).rejects.toThrow("the tool agency_create_goal is not available");
    expect(api.setFindingStatus).not.toHaveBeenCalled();
  });
});

describe("questionAboutFinding", () => {
  it("quotes the title and the detail", () => {
    expect(questionAboutFinding(finding(), "why?")).toBe('About your suggestion "Add a goal" (Members need one): why?');
  });

  it("leaves out the parentheses when there is no detail", () => {
    expect(questionAboutFinding(finding({ detail: "" }), "why?")).toBe('About your suggestion "Add a goal": why?');
  });
});
