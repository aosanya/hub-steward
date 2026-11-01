import { beforeEach, describe, expect, it, vi } from "vitest";
import { draftScope } from "../../data/draft";
import { callTool } from "../../wakala/mcp";
import { loadObjectiveCards, measureProgress, measuresFor, objectiveRows, setMeasure, workflowsOfObjective } from "./objectivesData";

vi.mock("../../wakala/mcp");
vi.mock("../../data/draft");
vi.mock("../../data/features", () => ({ measuresOn: true, withoutMeasuresOff: (tools: string[]) => tools }));

const callToolMock = vi.mocked(callTool);

type Answers = Record<string, unknown>;

const answer = (answers: Answers) => {
  callToolMock.mockImplementation(async (_hub, tool) => {
    const given = answers[tool];
    if (given instanceof Error) throw given;
    return given as never;
  });
};

const written = () => {
  const call = callToolMock.mock.calls.find((c) => c[1] === "agency_propose_write")?.[2] as { kind: string; summary: string; payload: string };
  return { kind: call.kind, summary: call.summary, payload: JSON.parse(call.payload) };
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(draftScope).mockResolvedValue({ draft_id: "d1" });
});

describe("how far a measure has come", () => {
  const base = { id: "m", name: "N", now: "", target: "10", unit: "", status: "" };

  it("starts from zero when nothing is recorded", () => {
    expect(measureProgress(base)).toBe("0 / 10");
  });

  it("puts the unit after the target", () => {
    expect(measureProgress({ ...base, now: "4", unit: "kg" })).toBe("4 / 10 kg");
  });

  it("does not end on a dangling slash when no target is set", () => {
    expect(measureProgress({ ...base, now: "4", target: "" })).not.toMatch(/\/\s*$/);
  });
});

describe("loading the measures", () => {
  it("reads numbers and words, leaves other values blank", async () => {
    answer({ agency_list_measures: [{ id: "m1", name: "Yield", current: 4, target: "10", unit: "kg", objective_id: "o1" }, { id: "m2", current: {}, target: null, objective_id: "o1" }] });
    const measures = await measuresFor("h", "o1");
    expect(measures[0]).toMatchObject({ now: "4", target: "10", unit: "kg" });
    expect(measures[1]).toMatchObject({ now: "", target: "" });
  });

  it("keeps only the measures of the asked objective even if the tool returns others", async () => {
    answer({ agency_list_measures: [{ id: "a", objective_id: "o1" }, { id: "b", objective_id: "o2" }] });
    expect((await measuresFor("h", "o1")).map((m) => m.id)).toEqual(["a"]);
    expect(callToolMock).toHaveBeenCalledWith("h", "agency_list_measures", { draft_id: "d1", objective_id: "o1" });
  });

  it("returns every measure when no objective is asked", async () => {
    answer({ agency_list_measures: [{ id: "a", objective_id: "o1" }, { id: "b", objective_id: "o2" }] });
    expect(await measuresFor("h")).toHaveLength(2);
  });

  it("is empty when the tool fails", async () => {
    answer({ agency_list_measures: new Error("down") });
    expect(await measuresFor("h", "o1")).toEqual([]);
  });
});

describe("loading the objective cards", () => {
  const answers = {
    agency_list_goals: [{ id: "g1", code: "G1", title: "Grow" }],
    agency_list_objectives: [
      { id: "o1", code: "O1", title: "Sell", goal_id: "g1" },
      { id: "o2", code: "O2", title: "Orphan", goal_id: "missing" },
    ],
    agency_list_workflow_objectives: [
      { objective_id: "o1", workflow_id: "w1" },
      { objective_id: "o1", workflow_id: "gone" },
      { objective_id: "o2", workflow_id: "w2" },
      { objective_id: "o2", workflow_id: "w1" },
    ],
    agency_list_workflows: [{ id: "w1", code: "W1", name: "Buy" }, { id: "w2", code: "", name: "Ship" }],
    agency_list_work_items: [{ workflow_id: "w1" }, { workflow_id: "w1" }, { workflow_id: "w2" }],
    agency_list_measures: [{ id: "m1", name: "Yield", target: "5", current: "1", objective_id: "o1" }],
  };

  it("joins each objective to its goal, workflows with step counts, and measures", async () => {
    answer(answers);
    const cards = await loadObjectiveCards("h");
    expect(cards[0].goal).toEqual({ id: "g1", code: "G1", title: "Grow" });
    expect(cards[0].workflows).toEqual([
      {
        id: "w1",
        code: "W1",
        name: "Buy",
        steps: 2,
        objectives: [
          { id: "o1", code: "O1" },
          { id: "o2", code: "O2" },
        ],
      },
    ]);
    expect(cards[0].measures).toHaveLength(1);
    expect(cards[1].goal).toBeNull();
    expect(cards[1].workflows.map((workflow) => workflow.steps)).toEqual([1, 2]);
    expect(cards[1].measures).toEqual([]);
  });

  it("is empty for a hub with no objectives", async () => {
    answer({ ...answers, agency_list_objectives: [] });
    expect(await loadObjectiveCards("h")).toEqual([]);
  });

  it("still lists the objectives when the measures cannot be read", async () => {
    answer({ ...answers, agency_list_measures: new Error("down") });
    const cards = await loadObjectiveCards("h");
    expect(cards).toHaveLength(2);
    expect(cards[0].measures).toEqual([]);
  });

  it("fails when the objectives themselves cannot be read", async () => {
    answer({ ...answers, agency_list_objectives: new Error("down") });
    await expect(loadObjectiveCards("h")).rejects.toThrow("down");
  });

  it("flattens the cards to table rows", async () => {
    answer(answers);
    const rows = await objectiveRows("h", {});
    expect(rows[0]).toEqual({ id: "o1", code: "O1", title: "Sell", goal: "Grow", workflows: "W1 Buy", measure: "Yield: 1 / 5" });
    expect(rows[1].goal).toBe("");
    expect(rows[1].workflows).toBe("Ship; W1 Buy");
  });

  it("gives the workflows of one objective, or none", async () => {
    answer(answers);
    expect((await workflowsOfObjective("h", "o1")).map((w) => w.id)).toEqual(["w1"]);
    expect(await workflowsOfObjective("h", "o9")).toEqual([]);
  });
});

describe("setting a measure", () => {
  const values = { objective_id: " o1 ", name: " Yield ", target: " 10 ", unit: " kg ", objective_code: " O1 " };

  it("proposes one trimmed write naming the objective by its code", async () => {
    answer({ agency_propose_write: {} });
    expect(await setMeasure("h", values)).toBe("accepted");
    expect(written()).toEqual({
      kind: "agency_set_measure",
      summary: "Set the measure of O1: Yield, target 10 kg",
      payload: { objective_id: "o1", name: "Yield", target: "10", unit: "kg" },
    });
  });

  it("leaves the unit out when there is none and names the objective by id", async () => {
    answer({ agency_propose_write: {} });
    await setMeasure("h", { objective_id: "o1", name: "Yield", target: "10" });
    expect(written().summary).toBe("Set the measure of o1: Yield, target 10");
    expect(written().payload).not.toHaveProperty("unit");
  });

  it.each([
    ["an objective", { ...values, objective_id: " " }, "objective is required"],
    ["a measure", { ...values, name: "" }, "measure is required"],
    ["a target", { ...values, target: " " }, "target is required"],
  ])("refuses a missing %s", async (_, given, message) => {
    await expect(setMeasure("h", given)).rejects.toThrow(message);
    expect(callToolMock).not.toHaveBeenCalled();
  });

  it("refuses a value that is not text", async () => {
    await expect(setMeasure("h", { ...values, target: 10 })).rejects.toThrow("that was not understood");
  });
});
