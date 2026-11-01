import { beforeEach, describe, expect, it, vi } from "vitest";
import { callTool } from "../wakala/mcp";
import { draftScope, workingDraftId } from "./draft";
import {
  isFailed,
  loadChoices,
  loadRuleLines,
  loadScenario,
  loadScenarios,
  newestFirst,
  ruleLines,
  runOf,
  runOne,
  runScenarios,
  saveAddScenario,
  scenarioOf,
  totalTokens,
  type NewScenario,
  type RunLine,
  type Scenario,
} from "./scenario";

vi.mock("../wakala/mcp");
vi.mock("./draft");

const callToolMock = vi.mocked(callTool);

type Answers = Record<string, unknown>;

const answer = (answers: Answers) => {
  callToolMock.mockImplementation(async (_hub, tool, args) => {
    const given = answers[tool];
    if (typeof given === "function") return (given as (args: unknown) => unknown)(args) as never;
    if (given instanceof Error) throw given;
    return given as never;
  });
};

const runLine = (over: Partial<RunLine> = {}): RunLine => ({
  id: "r",
  result: "passed",
  tokens: 0,
  startedAt: "",
  finishedAt: "",
  stopReason: "",
  draftVersion: "",
  rules: [],
  ...over,
});

const scenario = (over: Partial<Scenario> = {}): Scenario => ({
  id: "s",
  name: "S",
  summary: "",
  workflowId: "",
  workflow: "",
  result: "not_run",
  lastRunId: "",
  rules: [],
  actors: [],
  blocks: [],
  last: null,
  ...over,
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(draftScope).mockResolvedValue({ draft_id: "d1" });
  vi.mocked(workingDraftId).mockResolvedValue("d1");
});

describe("reading a run", () => {
  it("collects the rules checked across every step and tolerates malformed pieces", () => {
    const run = runOf({
      id: "r1",
      result: "failed",
      tokens: "12",
      steps: [{ rules: [{ code: "R1", held: true }, "bad", { code: "R2", held: "yes" }] }, null, { rules: [{ code: "R3", held: false }] }, { rules: "x" }],
    });
    expect(run.tokens).toBe(0);
    expect(run.rules).toEqual([
      { code: "R1", held: true },
      { code: "R2", held: false },
      { code: "R3", held: false },
    ]);
  });
});

describe("reading a scenario", () => {
  it("falls back to not run for a result it does not know", () => {
    expect(scenarioOf({ result: "exploded" }).result).toBe("not_run");
    expect(scenarioOf({}).result).toBe("not_run");
    expect(scenarioOf({ result: "stopped" }).result).toBe("stopped");
  });

  it("reads actors, blocks, and prefers the endpoint over the tool name", () => {
    const read = scenarioOf({
      id: "s1",
      rules: ["R1", 4, "R2"],
      actors: [{ id: "a", name: "Farmer", built_in: true }, 3],
      blocks: [
        { step_id: "x", endpoint: "ep", tool: "t", fields: [{ prompt: "P", free: false, value: "v" }, { prompt: "Q" }] },
        { step_id: "y", tool: "t" },
      ],
    });
    expect(read.rules).toEqual(["R1", "R2"]);
    expect(read.actors).toHaveLength(1);
    expect(read.actors[0].builtIn).toBe(true);
    expect(read.blocks[0].endpoint).toBe("ep");
    expect(read.blocks[1].endpoint).toBe("t");
    expect(read.blocks[0].fields).toEqual([
      { prompt: "P", free: false, value: "v" },
      { prompt: "Q", free: true, value: "" },
    ]);
  });
});

describe("ordering runs", () => {
  it("puts the newest first without changing the list it was given", () => {
    const runs = [runLine({ id: "a", startedAt: "2026-01-01T00:00:00Z" }), runLine({ id: "b", startedAt: "2026-03-01T00:00:00Z" }), runLine({ id: "c", startedAt: "2026-02-01T00:00:00Z" })];
    expect(newestFirst(runs).map((r) => r.id)).toEqual(["b", "c", "a"]);
    expect(runs.map((r) => r.id)).toEqual(["a", "b", "c"]);
  });

  it("keeps runs with no start time in their given order instead of scrambling", () => {
    const runs = [runLine({ id: "a" }), runLine({ id: "b" }), runLine({ id: "c" })];
    expect(newestFirst(runs).map((r) => r.id)).toEqual(["a", "b", "c"]);
  });
});

describe("summing and spotting failures", () => {
  it("adds the tokens of each scenario's last run and ignores those never run", () => {
    expect(totalTokens([scenario({ last: runLine({ tokens: 5 }) }), scenario(), scenario({ last: runLine({ tokens: 7 }) })])).toBe(12);
    expect(totalTokens([])).toBe(0);
  });

  it("flags only the failed result", () => {
    expect(isFailed(scenario({ result: "failed" }))).toBe(true);
    expect(isFailed(scenario({ result: "stopped" }))).toBe(false);
  });
});

describe("loading the scenarios", () => {
  it("lists in the working draft and attaches the run each scenario names", async () => {
    answer({
      agency_list_scenarios: [{ id: "s1", name: "One", last_run_id: "r2" }, { id: "s2", name: "Two" }],
      agency_list_test_runs: [{ id: "r1", tokens: 1 }, { id: "r2", tokens: 2 }],
    });
    const loaded = await loadScenarios("h");
    expect(loaded[0].last?.id).toBe("r2");
    expect(loaded[1].last).toBeNull();
    expect(callToolMock.mock.calls.filter((c) => c[1] === "agency_list_test_runs")).toHaveLength(1);
    expect(callToolMock).toHaveBeenCalledWith("h", "agency_list_scenarios", { draft_id: "d1" });
  });

  it("still lists a scenario whose runs could not be read", async () => {
    answer({ agency_list_scenarios: [{ id: "s1", last_run_id: "r1" }], agency_list_test_runs: new Error("down") });
    const loaded = await loadScenarios("h");
    expect(loaded).toHaveLength(1);
    expect(loaded[0].last).toBeNull();
  });

  it("is empty for an empty or malformed answer", async () => {
    answer({ agency_list_scenarios: null });
    expect(await loadScenarios("h")).toEqual([]);
  });

  it("takes the newest run as the last when the named one is gone, whatever order the tool answers in", async () => {
    answer({
      agency_list_scenarios: [{ id: "s1", last_run_id: "gone" }],
      agency_list_test_runs: [
        { id: "old", started_at: "2026-01-01T00:00:00Z" },
        { id: "new", started_at: "2026-03-01T00:00:00Z" },
      ],
    });
    expect((await loadScenarios("h"))[0].last?.id).toBe("new");
  });
});

describe("loading one scenario", () => {
  it("is null when the answer is not a record", async () => {
    answer({ agency_get_scenario: null, agency_list_test_runs: [] });
    expect(await loadScenario("h", "s1")).toBeNull();
  });

  it("sorts the runs and uses the newest when the named run is gone", async () => {
    answer({
      agency_get_scenario: { id: "s1", last_run_id: "gone" },
      agency_list_test_runs: [
        { id: "old", started_at: "2026-01-01T00:00:00Z" },
        { id: "new", started_at: "2026-03-01T00:00:00Z" },
      ],
    });
    const loaded = await loadScenario("h", "s1");
    expect(loaded?.runs.map((r) => r.id)).toEqual(["new", "old"]);
    expect(loaded?.scenario.last?.id).toBe("new");
  });

  it("still shows the scenario when its runs fail to load", async () => {
    answer({ agency_get_scenario: { id: "s1" }, agency_list_test_runs: new Error("down") });
    const loaded = await loadScenario("h", "s1");
    expect(loaded?.runs).toEqual([]);
    expect(loaded?.scenario.id).toBe("s1");
  });
});

describe("the rules and how the scenarios hold them", () => {
  const rules = [{ code: "R1", text: "One" }, { code: "R2", text: "Two" }, { code: "R3", text: "Three" }];

  it("marks a rule held by a passing scenario, failed by a failing last run and otherwise untested", () => {
    const lines = ruleLines(rules, [
      scenario({ name: "A", result: "passed", rules: ["R1", "R2"], last: runLine({ rules: [{ code: "R2", held: false }] }) }),
      scenario({ name: "B", result: "failed", rules: ["R3"] }),
    ]);
    expect(lines.map((l) => [l.code, l.status])).toEqual([
      ["R1", "held"],
      ["R2", "failed"],
      ["R3", "untested"],
    ]);
    expect(lines[1].failedIn).toEqual(["A"]);
    expect(lines[0].by).toEqual(["A"]);
  });

  it("lets a failure outrank a hold from another scenario", () => {
    const [line] = ruleLines(
      [{ code: "R1" }],
      [scenario({ name: "A", result: "passed", rules: ["R1"] }), scenario({ name: "B", last: runLine({ rules: [{ code: "R1", held: false }] }) })],
    );
    expect(line.status).toBe("failed");
    expect(line.by).toEqual(["A"]);
    expect(line.failedIn).toEqual(["B"]);
  });

  it("loads rules and scenarios together", async () => {
    answer({ agency_list_rules: rules, agency_list_scenarios: [{ id: "s", name: "A", result: "passed", rules: ["R1"] }] });
    const lines = await loadRuleLines("h");
    expect(lines.map((l) => l.status)).toEqual(["held", "untested", "untested"]);
  });
});

describe("loading the choices for a new scenario", () => {
  it("groups each workflow's steps and keeps options only for choice questions", async () => {
    answer({
      agency_list_workflows: [{ id: "w1", name: "Buy" }, { id: "w2", name: "Sell" }],
      agency_list_work_items: [
        {
          id: "st1",
          workflow_id: "w1",
          title: "Ask",
          role_id: "r",
          questions: [
            { prompt: "Which", answer_type: "single_choice", options: ["a", 1, "b"], options_from: "groups" },
            { prompt: "Why", answer_type: "text", options: ["x"], options_from: "groups" },
            { prompt: "", answer_type: "single_choice" },
          ],
        },
        { id: "st2", workflow_id: "w2" },
      ],
      agency_list_pickers: {
        actors: [
          { id: "ag", name: "The agency", kind: "agency" },
          { id: "r", name: "Farmer", kind: "role" },
          { id: "r2", name: "", kind: "role" },
          { id: "g1", name: "North", kind: "group" },
          { id: "g2", name: "", kind: "group" },
        ],
        answer_types: ["free_text"],
      },
    });
    const choices = await loadChoices("h");
    expect(choices.workflows[0].steps).toHaveLength(1);
    expect(choices.workflows[0].steps[0].prompts).toEqual(["Which", "Why"]);
    expect(choices.workflows[0].steps[0].questions).toEqual([
      { prompt: "Which", options: ["a", "b"], optionsFrom: "groups" },
      { prompt: "Why", options: [], optionsFrom: "" },
    ]);
    expect(choices.workflows[1].steps).toHaveLength(1);
    expect(choices.roles).toEqual([{ id: "r", name: "Farmer" }]);
    expect(choices.groups).toEqual([{ id: "g1", name: "North", parentId: "" }]);
    expect(callToolMock).toHaveBeenCalledWith("h", "agency_list_pickers", { draft_id: "d1" });
    expect(callToolMock).not.toHaveBeenCalledWith("h", "agency_list_roles", expect.anything());
    expect(callToolMock).not.toHaveBeenCalledWith("h", "actor_list_groups", expect.anything());
  });

  it("offers no roles and no groups when the pickers answer nothing", async () => {
    answer({ agency_list_workflows: [], agency_list_work_items: [], agency_list_pickers: null });
    const choices = await loadChoices("h");
    expect(choices.roles).toEqual([]);
    expect(choices.groups).toEqual([]);
  });
});

describe("running scenarios", () => {
  it("runs the chosen ones in the working draft", async () => {
    answer({ agency_run_scenarios: {} });
    await runScenarios("h", ["a", "b"]);
    expect(callToolMock).toHaveBeenCalledWith("h", "agency_run_scenarios", { draft_id: "d1", scenario_ids: ["a", "b"] });
  });

  it("returns the id of the run it started, or none", async () => {
    answer({ agency_run_scenario: { id: "run9" } });
    expect(await runOne("h", "s")).toBe("run9");
    answer({ agency_run_scenario: null });
    expect(await runOne("h", "s")).toBe("");
  });
});

describe("adding a scenario", () => {
  const draft: NewScenario = {
    name: "  Buy now ",
    summary: " Once ",
    workflowId: "w1",
    actors: [
      { name: " Farmer 1 ", roleId: "r1" },
      { name: "   ", roleId: "r2" },
    ],
    inputs: [
      { stepId: "s1", field: "Bags", value: " 3 " },
      { stepId: "s1", field: "Product", value: "  " },
    ],
  };
  const created = () => callToolMock.mock.calls.filter((c) => c[1] === "agency_create_scenario").map((c) => c[2]);

  it("creates one trimmed scenario at once, leaving blank actors and inputs out", async () => {
    answer({ agency_create_scenario: {} });
    expect(await saveAddScenario("h", draft)).toBe("done");
    expect(created()).toEqual([
      {
        draft_id: "d1",
        name: "Buy now",
        summary: "Once",
        workflow_id: "w1",
        actors: [{ name: "Farmer 1", role_id: "r1" }],
        inputs: [{ step_id: "s1", field: "Bags", value: "3" }],
      },
    ]);
    expect(callToolMock.mock.calls.some((c) => c[1] === "agency_propose_write")).toBe(false);
  });

  it("starts a draft when none is open and creates the scenario in it", async () => {
    vi.mocked(draftScope).mockResolvedValue({});
    answer({ agency_create_draft: { id: "d9" }, agency_create_scenario: {} });
    await saveAddScenario("h", draft);
    expect(created()[0]).toMatchObject({ draft_id: "d9" });
  });

  it("lets a refusal from the tool through", async () => {
    answer({ agency_create_scenario: new Error("a workflow of another draft is refused") });
    await expect(saveAddScenario("h", draft)).rejects.toThrow("a workflow of another draft is refused");
  });

  it("refuses a blank name or no workflow before asking anything", async () => {
    await expect(saveAddScenario("h", { ...draft, name: "  " })).rejects.toThrow("name is required");
    await expect(saveAddScenario("h", { ...draft, workflowId: "" })).rejects.toThrow("workflow_id is required");
    expect(callToolMock).not.toHaveBeenCalled();
  });
});
