import { beforeEach, describe, expect, it, vi } from "vitest";
import { callTool } from "../wakala/mcp";
import { isActive, loadRunReport, loadTestRun, refusalOf, rulesHeldIn, stopRun, testRunOf } from "./testRun";

vi.mock("../wakala/mcp");

const callToolMock = vi.mocked(callTool);

beforeEach(() => {
  vi.resetAllMocks();
});

describe("reading a test run", () => {
  it("reads steps with their rules, trail and what was sent and answered", () => {
    const run = testRunOf({
      id: "r1",
      scenario_id: "s1",
      steps: [
        {
          step_id: "st",
          failed: true,
          tokens: 4,
          sent: { a: 1 },
          answer: "ok",
          rules: [{ code: "R1", held: true }, 5],
          trail: [{ step_id: "st", module: "m", endpoint: "e", text: "t", at: "now" }, "bad"],
        },
        7,
      ],
      trail: [{ text: "x" }],
      stored: [{ record: "member", holds: "name", rows: 3 }, { record: "x", rows: "3" }],
    });
    expect(run.scenarioId).toBe("s1");
    expect(run.steps).toHaveLength(1);
    expect(run.steps[0]).toMatchObject({ failed: true, tokens: 4, sent: '{"a":1}', answer: "ok", rules: [{ code: "R1", held: true }] });
    expect(run.steps[0].trail).toHaveLength(1);
    expect(run.trail[0].text).toBe("x");
    expect(run.stored).toEqual([
      { record: "member", holds: "name", rows: 3 },
      { record: "x", holds: "", rows: 0 },
    ]);
  });

  it("shows an empty object or a number sent as nothing", () => {
    const [step] = testRunOf({ steps: [{ sent: {}, answer: 5 }] }).steps;
    expect(step.sent).toBe("");
    expect(step.answer).toBe("");
  });

  it("reads the draft label, the token budget and whether a wait was acted out", () => {
    const run = testRunOf({ draft_label: "Latest edit", token_budget: 30000, steps: [{ waited: true }, {}] });
    expect(run.draftLabel).toBe("Latest edit");
    expect(run.tokenBudget).toBe(30000);
    expect(run.steps.map((step) => step.waited)).toEqual([true, false]);
  });

  it("has no draft label and no budget when the run names none", () => {
    const run = testRunOf({ token_budget: "30000" });
    expect(run.draftLabel).toBe("");
    expect(run.tokenBudget).toBe(0);
  });

  it("is empty for an empty item", () => {
    const run = testRunOf({});
    expect(run.steps).toEqual([]);
    expect(run.trail).toEqual([]);
    expect(run.stored).toEqual([]);
  });
});

describe("whether a run is still going", () => {
  it.each([
    ["running", true],
    ["waiting", true],
    ["passed", false],
    ["failed", false],
    ["stopped", false],
    ["", false],
  ])("%j is %s", (result, active) => {
    expect(isActive(result)).toBe(active);
  });
});

describe("loading a run page", () => {
  it("sorts the other runs newest first and names the scenario", async () => {
    callToolMock.mockImplementation(async (_h, tool) => {
      if (tool === "agency_get_test_run") return { id: "r1", scenario_id: "s1" } as never;
      if (tool === "agency_list_test_runs") return [{ id: "a", started_at: "2026-01-01T00:00:00Z" }, { id: "b", started_at: "2026-02-01T00:00:00Z" }] as never;
      return { name: "Buy now" } as never;
    });
    const page = await loadTestRun("h", "r1");
    expect(page.runs.map((r) => r.id)).toEqual(["b", "a"]);
    expect(page.scenarioName).toBe("Buy now");
  });

  it("still shows the run when the other runs and the scenario cannot be read", async () => {
    callToolMock.mockImplementation(async (_h, tool) => {
      if (tool === "agency_get_test_run") return { id: "r1", scenario_id: "s1" } as never;
      throw new Error("down");
    });
    const page = await loadTestRun("h", "r1");
    expect(page.runs).toEqual([]);
    expect(page.scenarioName).toBe("");
    expect(page.run.id).toBe("r1");
  });

  it.each([[null], ["text"], [[]]])("fails when the run answer is %j", async (answer) => {
    callToolMock.mockResolvedValue(answer as never);
    await expect(loadTestRun("h", "r1")).rejects.toThrow("the run could not be read");
  });
});

describe("the rules a run held", () => {
  const run = testRunOf({
    steps: [
      { rules: [{ code: "RU-2", held: true }, { code: "RU-7", held: true }] },
      { rules: [{ code: "RU-7", held: false }, { code: "RU-2", held: true }] },
    ],
  });

  it("lists each code once, in the order the steps checked it, with the text the agency gives it", () => {
    expect(rulesHeldIn(run, [{ code: "RU-2", text: "Starts from a posted price" }, { code: "RU-7", text: "Asks once" }])).toEqual([
      { code: "RU-2", text: "Starts from a posted price", held: true },
      { code: "RU-7", text: "Asks once", held: false },
    ]);
  });

  it("keeps a code the agency no longer lists, without a text", () => {
    expect(rulesHeldIn(run, [])).toEqual([
      { code: "RU-2", text: "", held: true },
      { code: "RU-7", text: "", held: false },
    ]);
  });

  it("is empty for a run that checked no rule", () => {
    expect(rulesHeldIn(testRunOf({ steps: [{}] }), [{ code: "RU-2", text: "x" }])).toEqual([]);
  });
});

describe("loading the report of a run", () => {
  const answers = (more: Record<string, unknown> = {}) =>
    callToolMock.mockImplementation((async (_h: string, tool: string) => {
      const replies: Record<string, unknown> = {
        agency_get_test_run: {
          id: "r1",
          scenario_id: "s1",
          steps: [{ rules: [{ code: "RU-2", held: true }] }],
        },
        agency_get_scenario: {
          id: "s1",
          name: "Buy now",
          blocks: [{ step_id: "st1", title: "Start", kind: "fill_form", actor: "Coordinator", action: "Starts it", then: "It starts" }],
        },
        agency_get_agency: { agency: { name: "Siaya Farmers" } },
        agency_list_drafts: { items: [{ id: "d1", status: "open" }] },
        agency_list_rules: { items: [{ code: "RU-2", text: "A posted price" }] },
        ...more,
      };
      const reply = replies[tool];
      if (reply instanceof Error) throw reply;
      return reply ?? { items: [] };
    }) as never);

  it("brings the run, the script, the agency's name and the text of the rules it held", async () => {
    answers();
    const report = await loadRunReport("h", "r1");
    expect(report.run.id).toBe("r1");
    expect(report.scenario?.blocks[0]).toMatchObject({ actor: "Coordinator", then: "It starts" });
    expect(report.agency).toBe("Siaya Farmers");
    expect(report.rules).toEqual([{ code: "RU-2", text: "A posted price", held: true }]);
    expect(callToolMock).toHaveBeenCalledWith("h", "agency_list_rules", { draft_id: "d1" });
  });

  it("reads an agency name that is not nested", async () => {
    answers({ agency_get_agency: { name: "Flat Name" } });
    expect((await loadRunReport("h", "r1")).agency).toBe("Flat Name");
  });

  it("still gives the run when the scenario, the agency and the rules cannot be read", async () => {
    answers({ agency_get_scenario: new Error("down"), agency_get_agency: new Error("down"), agency_list_rules: new Error("down") });
    const report = await loadRunReport("h", "r1");
    expect(report.scenario).toBeNull();
    expect(report.agency).toBe("");
    expect(report.rules).toEqual([{ code: "RU-2", text: "", held: true }]);
  });

  it("fails when the run cannot be read", async () => {
    answers({ agency_get_test_run: new Error("gone") });
    await expect(loadRunReport("h", "r1")).rejects.toThrow("gone");
  });
});

describe("stopping a run", () => {
  it("asks for the run to stop by id", async () => {
    callToolMock.mockResolvedValue({} as never);
    await stopRun("h", "r1");
    expect(callToolMock).toHaveBeenCalledWith("h", "agency_stop_test_run", { test_run_id: "r1" });
  });

  it("lets a refusal through", async () => {
    callToolMock.mockRejectedValue(new Error("agency_stop_test_run: already finished"));
    await expect(stopRun("h", "r1")).rejects.toThrow("already finished");
  });
});

describe("the words of a refusal", () => {
  it("drops the tool name in front of the reason", () => {
    expect(refusalOf(new Error("agency_stop_test_run: already finished"))).toBe("already finished");
  });

  it("keeps a message that has no tool name", () => {
    expect(refusalOf(new Error("Already finished"))).toBe("Already finished");
  });

  it("is empty for anything that is not an error", () => {
    expect(refusalOf("x")).toBe("");
    expect(refusalOf(undefined)).toBe("");
  });
});
