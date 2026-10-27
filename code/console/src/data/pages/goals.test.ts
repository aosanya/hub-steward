import { beforeEach, describe, expect, it, vi } from "vitest";
import { callTool } from "../../wakala/mcp";
import { goalDetail, goalsPage, objectiveDetail } from "./goals";

vi.mock("../../wakala/mcp");

const answerWith = (replies: Record<string, unknown>) =>
  vi.mocked(callTool).mockImplementation(async (_hubId, tool) => {
    if (!Object.hasOwn(replies, tool) && tool === "agency_list_drafts") return { items: [] } as never;
    if (!Object.hasOwn(replies, tool)) throw new Error("unexpected tool " + tool);
    return replies[tool] as never;
  });

const toolsCalled = () => vi.mocked(callTool).mock.calls.map((call) => call[1]);

const argsOf = (tool: string) => vi.mocked(callTool).mock.calls.find((call) => call[1] === tool)?.[2];

const proposal = () => {
  const args = argsOf("agency_propose_write") as { kind: string; summary: string; payload: string };
  return { kind: args.kind, summary: args.summary, payload: JSON.parse(args.payload) };
};

const run = (id: "goals", values: Record<string, unknown>) => goalsPage.actions![id]("h1", values);

beforeEach(() => {
  vi.mocked(callTool).mockReset();
});

describe("the goals page", () => {
  it("offers Add a goal and lists the tools it reads and the writes it proposes", () => {
    expect(goalsPage.spec.id).toBe("goals");
    expect(goalsPage.spec.title).toBe("Goals");
    expect(goalsPage.spec.primary).toBe("Add a goal");
    expect(goalsPage.spec.columns).toEqual([
      { key: "code", label: "Code" },
      { key: "title", label: "Goal" },
      { key: "objectives", label: "Objectives" },
    ]);
    expect(goalsPage.spec.tools).toEqual(
      expect.arrayContaining(["agency_list_goals", "agency_create_goal", "agency_create_objective", "agency_link_workflow_objective", "agency_list_workflows", "agency_list_workflow_objectives", "agency_list_work_items", "agency_list_role_assignments_for_work_item"]),
    );
  });

  it("shows each goal with the number of objectives under it", async () => {
    answerWith({
      agency_list_goals: {
        items: [
          { id: "g1", code: "G-1", title: "Serve the valley" },
          { id: "g2", code: "G-2", title: "Fund the hub" },
        ],
      },
      agency_list_objectives: {
        items: [
          { id: "o1", goal_id: "g1" },
          { id: "o2", goal_id: "g1" },
          { id: "o3", goal_id: "g2" },
        ],
      },
    });

    const rows = await goalsPage.rows("h1", { draft_id: "d1" });

    expect(rows).toEqual([
      { id: "g1", code: "G-1", title: "Serve the valley", objectives: 2 },
      { id: "g2", code: "G-2", title: "Fund the hub", objectives: 1 },
    ]);
  });

  it("reads the draft the manager is looking at when a draft id is in the query", async () => {
    answerWith({ agency_list_goals: [], agency_list_objectives: [] });

    await goalsPage.rows("h1", { draft_id: "d1" });

    expect(argsOf("agency_list_goals")).toEqual({ draft_id: "d1" });
    expect(argsOf("agency_list_objectives")).toEqual({ draft_id: "d1" });
  });

  it("reads the live agency when the query has no draft id", async () => {
    answerWith({ agency_list_goals: [], agency_list_objectives: [] });

    await goalsPage.rows("h1", {});

    expect(argsOf("agency_list_goals")).toEqual({});
  });

  it("shows an empty list when the answers are bare empty arrays", async () => {
    answerWith({ agency_list_goals: [], agency_list_objectives: [] });

    expect(await goalsPage.rows("h1", {})).toEqual([]);
  });

  it("counts a goal with no objectives as zero", async () => {
    answerWith({ agency_list_goals: [{ id: "g1", title: "Alone" }], agency_list_objectives: {} });

    expect(await goalsPage.rows("h1", {})).toEqual([{ id: "g1", code: "", title: "Alone", objectives: 0 }]);
  });

  it("shows only the objectives of the chosen goal after checking the goal exists", async () => {
    answerWith({
      agency_get_goal: { id: "g1", title: "Serve the valley" },
      agency_list_objectives: [
        { id: "o1", code: "O-1", title: "Open a clinic", goal_id: "g1" },
        { id: "o9", title: "Other", goal_id: "g2" },
      ],
    });

    const rows = await goalsPage.rows("h1", { goal: "g1" });

    expect(rows).toEqual([{ id: "o1", code: "O-1", title: "Open a clinic", goal_id: "g1" }]);
    expect(toolsCalled()[0]).toBe("agency_get_goal");
    expect(argsOf("agency_get_goal")).toEqual({ goal_id: "g1" });
  });

  it("keeps an objective that names no goal when a goal is chosen", async () => {
    answerWith({ agency_get_goal: {}, agency_list_objectives: [{ id: "o2", title: "Loose" }] });

    expect(await goalsPage.rows("h1", { goal: "g1" })).toEqual([{ id: "o2", code: "", title: "Loose", goal_id: "g1" }]);
  });

  it("fails the page without listing objectives when the chosen goal is unknown", async () => {
    vi.mocked(callTool).mockRejectedValue(new Error("agency_get_goal: not found"));

    await expect(goalsPage.rows("h1", { goal: "missing" })).rejects.toThrow("not found");
    expect(toolsCalled()).toEqual(["agency_get_goal"]);
  });

  it("fails the page when a tool fails", async () => {
    vi.mocked(callTool).mockRejectedValue(new Error("agency_list_goals: boom"));

    await expect(goalsPage.rows("h1", {})).rejects.toThrow("boom");
  });
});

describe("adding a goal", () => {
  it("asks for approval to add the goal and never creates it directly", async () => {
    answerWith({ agency_propose_write: { status: "pending" } });

    const result = await run("goals", { title: "  Open a seed library ", description: " Share seeds " });

    expect(result).toBe("accepted");
    expect(toolsCalled()).toEqual(["agency_propose_write"]);
    expect(proposal()).toEqual({
      kind: "agency_create_goal",
      summary: "Add the goal Open a seed library",
      payload: { title: "Open a seed library", description: "Share seeds" },
    });
  });

  it("refuses an empty title without calling anything", async () => {
    await expect(run("goals", { title: "  " })).rejects.toThrow("title is required");
    await expect(run("goals", {})).rejects.toThrow("title is required");

    expect(callTool).not.toHaveBeenCalled();
  });

  it("sends an empty description when none was typed", async () => {
    answerWith({ agency_propose_write: {} });

    await run("goals", { title: "A" });

    expect(proposal().payload).toEqual({ title: "A", description: "" });
  });

  it("fails when the approval request fails", async () => {
    vi.mocked(callTool).mockRejectedValue(new Error("boom"));

    await expect(run("goals", { title: "A" })).rejects.toThrow("boom");
  });
});

describe("reading one goal", () => {
  it("gives the goal's code, title and description from the goal tool", async () => {
    answerWith({ agency_get_goal: { id: "g1", code: "G-1", title: "Serve the valley", description: "All of it" } });

    expect(await goalDetail("h1", "g1")).toEqual({ id: "g1", code: "G-1", title: "Serve the valley", description: "All of it" });
    expect(argsOf("agency_get_goal")).toEqual({ goal_id: "g1" });
  });

  it("reads the goal out of an answer that wraps it and falls back to the id asked for", async () => {
    answerWith({ agency_get_goal: { goal: { title: "Wrapped" } } });

    expect(await goalDetail("h1", "g7")).toEqual({ id: "g7", code: "", title: "Wrapped", description: "" });
  });

  it("asks for the goal by its id alone, because the goal tool takes no draft", async () => {
    answerWith({ agency_get_goal: {}, agency_list_drafts: { items: [{ id: "d1", status: "open" }] } });

    await goalDetail("h1", "g1");

    expect(argsOf("agency_get_goal")).toEqual({ goal_id: "g1" });
    expect(toolsCalled()).toEqual(["agency_get_goal"]);
  });

  it("fails when the goal tool fails", async () => {
    vi.mocked(callTool).mockRejectedValue(new Error("agency_get_goal: not found"));

    await expect(goalDetail("h1", "missing")).rejects.toThrow("not found");
  });
});

describe("reading one objective", () => {
  it("asks for the objective by its id alone, because the objective tool takes no draft", async () => {
    answerWith({ agency_get_objective: {}, agency_list_drafts: { items: [{ id: "d1", status: "open" }] } });

    await objectiveDetail("h1", "o1");

    expect(argsOf("agency_get_objective")).toEqual({ objective_id: "o1" });
    expect(toolsCalled()).toEqual(["agency_get_objective"]);
  });

  it("gives the objective's code, title, description and the goal it serves", async () => {
    answerWith({ agency_get_objective: { id: "o1", code: "O-1", title: "Open a clinic", description: "Weekly", goal_id: "g1" } });

    expect(await objectiveDetail("h1", "o1")).toEqual({
      id: "o1",
      code: "O-1",
      title: "Open a clinic",
      description: "Weekly",
      goalId: "g1",
    });
    expect(argsOf("agency_get_objective")).toEqual({ objective_id: "o1" });
  });

  it("names no goal when the objective serves none", async () => {
    answerWith({ agency_get_objective: { title: "Loose" } });

    expect(await objectiveDetail("h1", "o2")).toMatchObject({ id: "o2", goalId: "" });
  });
});

describe("the draft the goals are read from", () => {
  const drafts = {
    items: [
      { id: "d0", description: "Shelved", status: "archived" },
      { id: "d1", description: "Initial draft", status: "open" },
      { id: "d2", description: "Imported from Siaya Farmers' Group", status: "open" },
    ],
  };

  const argsOfAll = (tool: string) => vi.mocked(callTool).mock.calls.filter((call) => call[1] === tool).map((call) => call[2]);

  it("asks only the open drafts which one is the working draft", async () => {
    answerWith({ agency_list_drafts: drafts, agency_list_goals: [], agency_list_objectives: [] });

    await goalsPage.rows("h1", {});

    expect(argsOfAll("agency_list_drafts")).toEqual([{ status: "open" }]);
  });

  it("lists the goals and the objectives of the newest open draft when the query names none", async () => {
    answerWith({ agency_list_drafts: drafts, agency_list_goals: [], agency_list_objectives: [] });

    await goalsPage.rows("h1", {});

    expect(argsOf("agency_list_goals")).toEqual({ draft_id: "d2" });
    expect(argsOf("agency_list_objectives")).toEqual({ draft_id: "d2" });
  });

  it("lets a draft id in the query win over the working draft without asking for the drafts", async () => {
    answerWith({ agency_list_drafts: drafts, agency_list_goals: [], agency_list_objectives: [] });

    await goalsPage.rows("h1", { draft_id: "d1" });

    expect(argsOf("agency_list_goals")).toEqual({ draft_id: "d1" });
    expect(toolsCalled()).not.toContain("agency_list_drafts");
  });

  it("lists the objectives of a goal from the working draft after checking the goal by its id alone", async () => {
    answerWith({ agency_list_drafts: drafts, agency_get_goal: {}, agency_list_objectives: [] });

    await goalsPage.rows("h1", { goal: "g1" });

    expect(argsOf("agency_get_goal")).toEqual({ goal_id: "g1" });
    expect(argsOf("agency_list_objectives")).toEqual({ draft_id: "d2" });
  });

  it("reads the published agency, sending no draft id, when no draft is open", async () => {
    answerWith({
      agency_list_drafts: { items: [{ id: "d0", status: "archived" }] },
      agency_list_goals: [],
      agency_list_objectives: [],
    });

    await goalsPage.rows("h1", {});

    expect(argsOf("agency_list_goals")).toEqual({});
    expect(argsOf("agency_list_objectives")).toEqual({});
  });

  it("fails the page when the open drafts cannot be read, without listing any goal", async () => {
    vi.mocked(callTool).mockImplementation(async (_hubId, tool) => {
      if (tool === "agency_list_drafts") throw new Error("drafts are down");
      return [] as never;
    });

    await expect(goalsPage.rows("h1", {})).rejects.toThrow("drafts are down");
    expect(toolsCalled()).toEqual(["agency_list_drafts"]);
  });
});
