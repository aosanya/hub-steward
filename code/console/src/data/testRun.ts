import { callTool } from "../wakala/mcp";
import { draftScope } from "./draft";
import { isRecord, itemsOf, textOf, type Item } from "./pages/groups";
import { loadRuns, newestFirst, runOf, scenarioOf, type RuleCheck, type RunLine, type Scenario } from "./scenario";

export const runPollMs = 2000;

export type TrailLine = {
  stepId: string;
  module: string;
  endpoint: string;
  text: string;
  at: string;
};

export type StoredRows = { record: string; holds: string; rows: number };

export type RunStepLine = {
  stepId: string;
  step: string;
  actor: string;
  playedBy: string;
  did: string;
  recorded: string;
  rules: RuleCheck[];
  tokens: number;
  failed: boolean;
  waited: boolean;
  expected: string;
  found: string;
  endpoint: string;
  sent: string;
  answer: string;
  trail: TrailLine[];
};

export type TestRun = RunLine & {
  scenarioId: string;
  draftLabel: string;
  tokenBudget: number;
  steps: RunStepLine[];
  trail: TrailLine[];
  stored: StoredRows[];
};

export type RunPage = { run: TestRun; runs: RunLine[]; scenarioName: string; workflowId: string };

export type RuleHeld = { code: string; text: string; held: boolean };

export type RunReport = { run: TestRun; scenario: Scenario | null; agency: string; rules: RuleHeld[] };

const listOf = (value: unknown): Item[] => (Array.isArray(value) ? value.filter(isRecord) : []);

const trailLineOf = (item: Item): TrailLine => ({
  stepId: textOf(item, "step_id"),
  module: textOf(item, "module"),
  endpoint: textOf(item, "endpoint"),
  text: textOf(item, "text"),
  at: textOf(item, "at"),
});

const storedOf = (item: Item): StoredRows => ({
  record: textOf(item, "record"),
  holds: textOf(item, "holds"),
  rows: typeof item.rows === "number" ? item.rows : 0,
});

const shown = (value: unknown): string =>
  typeof value === "string" ? value : isRecord(value) && Object.keys(value).length > 0 ? JSON.stringify(value) : "";

const stepOf = (item: Item): RunStepLine => ({
  stepId: textOf(item, "step_id"),
  step: textOf(item, "step"),
  actor: textOf(item, "actor"),
  playedBy: textOf(item, "played_by"),
  did: textOf(item, "did"),
  recorded: textOf(item, "recorded"),
  rules: listOf(item.rules).map((rule) => ({ code: textOf(rule, "code"), held: rule.held === true })),
  tokens: typeof item.tokens === "number" ? item.tokens : 0,
  failed: item.failed === true,
  waited: item.waited === true,
  expected: textOf(item, "expected"),
  found: textOf(item, "found"),
  endpoint: textOf(item, "endpoint"),
  sent: shown(item.sent),
  answer: shown(item.answer),
  trail: listOf(item.trail).map(trailLineOf),
});

export const testRunOf = (item: Item): TestRun => ({
  ...runOf(item),
  scenarioId: textOf(item, "scenario_id"),
  draftLabel: textOf(item, "draft_label"),
  tokenBudget: typeof item.token_budget === "number" ? item.token_budget : 0,
  steps: listOf(item.steps).map(stepOf),
  trail: listOf(item.trail).map(trailLineOf),
  stored: listOf(item.stored).map(storedOf),
});

export const isActive = (result: string): boolean => result === "running" || result === "waiting";

const readRun = async (hubId: string, runId: string): Promise<TestRun> => {
  const item = await callTool<unknown>(hubId, "agency_get_test_run", { test_run_id: runId });
  if (!isRecord(item)) throw new Error("the run could not be read");
  return testRunOf(item);
};

export const loadTestRun = async (hubId: string, runId: string): Promise<RunPage> => {
  const run = await readRun(hubId, runId);
  const [runs, scenario] = await Promise.all([
    loadRuns(hubId, run.scenarioId).catch(() => []),
    callTool<unknown>(hubId, "agency_get_scenario", { scenario_id: run.scenarioId }).catch(() => null),
  ]);
  return { run, runs: newestFirst(runs), scenarioName: textOf(scenario, "name"), workflowId: textOf(scenario, "workflow_id") };
};

export const rulesHeldIn = (run: TestRun, listed: Item[]): RuleHeld[] => {
  const checks = run.steps.flatMap((step) => step.rules);
  return [...new Set(checks.map((check) => check.code))].map((code) => ({
    code,
    text: textOf(listed.find((rule) => textOf(rule, "code") === code), "text"),
    held: checks.filter((check) => check.code === code).every((check) => check.held),
  }));
};

const agencyNameOf = (answer: unknown): string => textOf(isRecord(answer) && isRecord(answer.agency) ? answer.agency : answer, "name");

export const loadRunReport = async (hubId: string, runId: string): Promise<RunReport> => {
  const run = await readRun(hubId, runId);
  const scope = await draftScope(hubId).catch(() => ({}));
  const [scenario, agency, rules] = await Promise.all([
    callTool<unknown>(hubId, "agency_get_scenario", { scenario_id: run.scenarioId }).catch(() => null),
    callTool<unknown>(hubId, "agency_get_agency").catch(() => null),
    callTool<unknown>(hubId, "agency_list_rules", scope).catch(() => []),
  ]);
  return {
    run,
    scenario: isRecord(scenario) ? scenarioOf(scenario) : null,
    agency: agencyNameOf(agency),
    rules: rulesHeldIn(run, itemsOf(rules)),
  };
};

export const stopRun = async (hubId: string, runId: string): Promise<void> => {
  await callTool(hubId, "agency_stop_test_run", { test_run_id: runId });
};

export const refusalOf = (error: unknown): string => (error instanceof Error ? error.message.replace(/^[a-z_]+:\s*/, "") : "");
