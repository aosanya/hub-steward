import { callTool } from "../wakala/mcp";
import { draftScope, workingDraftId } from "./draft";
import {
  isRecord,
  itemsOf,
  textOf,
  type Item,
} from "./pages/groups";
import { workingDraft } from "./pages/workflowDesign";
import type { ActionResult } from "./types";

export type ScenarioResult =
  | "not_run"
  | "waiting"
  | "running"
  | "passed"
  | "failed"
  | "stopped";

export const scenarioResults: ScenarioResult[] = [
  "not_run",
  "waiting",
  "running",
  "passed",
  "failed",
  "stopped",
];

export type RuleCheck = { code: string; held: boolean };

export type RunLine = {
  id: string;
  result: string;
  tokens: number;
  startedAt: string;
  finishedAt: string;
  stopReason: string;
  draftVersion: string;
  rules: RuleCheck[];
};

export type Actor = {
  id: string;
  name: string;
  kind: string;
  roleId: string;
  roleName: string;
  builtIn: boolean;
};

export type BlockField = { prompt: string; free: boolean; value: string };

export type Block = {
  stepId: string;
  code: string;
  title: string;
  kind: string;
  action: string;
  actor: string;
  then: string;
  endpoint: string;
  fields: BlockField[];
};

export type Scenario = {
  id: string;
  name: string;
  summary: string;
  workflowId: string;
  workflow: string;
  result: ScenarioResult;
  lastRunId: string;
  rules: string[];
  actors: Actor[];
  blocks: Block[];
  last: RunLine | null;
};

export type QuestionToFill = {
  prompt: string;
  options: string[];
  optionsFrom: string;
};

export type StepToFill = {
  id: string;
  title: string;
  roleId: string;
  prompts: string[];
  questions: QuestionToFill[];
};

export type ActorDraft = { id?: string; name: string; roleId: string };

export type InputDraft = { stepId: string; field: string; value: string };

export type EndpointDraft = { stepId: string; endpoint: string };

export type NewScenario = {
  name: string;
  summary: string;
  workflowId: string;
  actors: ActorDraft[];
  inputs: InputDraft[];
};

const textsOf = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];

const listOf = (value: unknown): Item[] =>
  Array.isArray(value) ? value.filter(isRecord) : [];

const stringsOf = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];

const resultOf = (value: string): ScenarioResult =>
  scenarioResults.includes(value as ScenarioResult)
    ? (value as ScenarioResult)
    : "not_run";

const numberOf = (record: Item, key: string): number =>
  typeof record[key] === "number" ? (record[key] as number) : 0;

const actorOf = (item: Item): Actor => ({
  id: textOf(item, "id"),
  name: textOf(item, "name"),
  kind: textOf(item, "kind"),
  roleId: textOf(item, "role_id"),
  roleName: textOf(item, "role_name"),
  builtIn: item.built_in === true,
});

const blockOf = (item: Item): Block => ({
  stepId: textOf(item, "step_id"),
  code: textOf(item, "code"),
  title: textOf(item, "title"),
  kind: textOf(item, "kind"),
  action: textOf(item, "action"),
  actor: textOf(item, "actor"),
  then: textOf(item, "then"),
  endpoint: textOf(item, "endpoint") || textOf(item, "tool"),
  fields: listOf(item.fields).map((field) => ({
    prompt: textOf(field, "prompt"),
    free: field.free !== false,
    value: textOf(field, "value"),
  })),
});

export const runOf = (item: Item): RunLine => ({
  id: textOf(item, "id"),
  result: textOf(item, "result"),
  tokens: numberOf(item, "tokens"),
  startedAt: textOf(item, "started_at"),
  finishedAt: textOf(item, "finished_at"),
  stopReason: textOf(item, "stop_reason"),
  draftVersion: textOf(item, "draft_version"),
  rules: listOf(item.steps).flatMap((step) =>
    listOf(step.rules).map((rule) => ({
      code: textOf(rule, "code"),
      held: rule.held === true,
    })),
  ),
});

export const scenarioOf = (
  item: Item,
  last: RunLine | null = null,
): Scenario => ({
  id: textOf(item, "id"),
  name: textOf(item, "name"),
  summary: textOf(item, "summary"),
  workflowId: textOf(item, "workflow_id"),
  workflow: textOf(item, "workflow"),
  result: resultOf(textOf(item, "result")),
  lastRunId: textOf(item, "last_run_id"),
  rules: stringsOf(item.rules),
  actors: listOf(item.actors).map(actorOf),
  blocks: listOf(item.blocks).map(blockOf),
  last,
});

export const newestFirst = (runs: RunLine[]): RunLine[] =>
  [...runs].sort(
    (a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt) || 0,
  );

export const loadRuns = async (
  hubId: string,
  scenarioId: string,
): Promise<RunLine[]> =>
  itemsOf(
    await callTool<unknown>(hubId, "agency_list_test_runs", {
      scenario_id: scenarioId,
    }),
  ).map(runOf);

const lastRunOf = (runs: RunLine[], lastRunId: string): RunLine | null =>
  runs.find((run) => run.id === lastRunId) ?? runs[0] ?? null;

export const loadScenarios = async (
  hubId: string,
  query: Record<string, string> = {},
): Promise<Scenario[]> => {
  const scope = await draftScope(hubId, query);
  const listed = itemsOf(
    await callTool<unknown>(hubId, "agency_list_scenarios", scope),
  );
  return Promise.all(
    listed.map(async (item) => {
      const lastRunId = textOf(item, "last_run_id");
      const runs =
        lastRunId === ""
          ? []
          : await loadRuns(hubId, textOf(item, "id")).catch(() => []);
      return scenarioOf(item, lastRunOf(newestFirst(runs), lastRunId));
    }),
  );
};

export type ScenarioDetail = { scenario: Scenario; runs: RunLine[] };

export const loadScenario = async (
  hubId: string,
  scenarioId: string,
): Promise<ScenarioDetail | null> => {
  const [item, runs] = await Promise.all([
    callTool<unknown>(hubId, "agency_get_scenario", {
      scenario_id: scenarioId,
    }),
    loadRuns(hubId, scenarioId).catch(() => []),
  ]);
  if (!isRecord(item)) return null;
  const sorted = newestFirst(runs);
  return {
    scenario: scenarioOf(item, lastRunOf(sorted, textOf(item, "last_run_id"))),
    runs: sorted,
  };
};

export const totalTokens = (scenarios: Scenario[]): number =>
  scenarios.reduce((sum, scenario) => sum + (scenario.last?.tokens ?? 0), 0);

export const isFailed = (scenario: Scenario): boolean =>
  scenario.result === "failed";

export type RuleLine = {
  code: string;
  text: string;
  status: "held" | "failed" | "untested";
  by: string[];
  failedIn: string[];
};

export const ruleLines = (rules: Item[], scenarios: Scenario[]): RuleLine[] =>
  rules.map((rule) => {
    const code = textOf(rule, "code");
    const failedIn = scenarios
      .filter((s) =>
        s.last?.rules.some((check) => check.code === code && !check.held),
      )
      .map((s) => s.name);
    const by = scenarios
      .filter((s) => s.result === "passed" && s.rules.includes(code))
      .map((s) => s.name);
    const status =
      failedIn.length > 0 ? "failed" : by.length > 0 ? "held" : "untested";
    return { code, text: textOf(rule, "text"), status, by, failedIn };
  });

export const loadRuleLines = async (
  hubId: string,
  query: Record<string, string> = {},
): Promise<RuleLine[]> => {
  const scope = await draftScope(hubId, query);
  const [rules, scenarios] = await Promise.all([
    callTool<unknown>(hubId, "agency_list_rules", scope),
    loadScenarios(hubId, query),
  ]);
  return ruleLines(itemsOf(rules), scenarios);
};

export type WorkflowChoice = { id: string; name: string; steps: StepToFill[] };

export type RoleChoice = { id: string; name: string };

export type GroupChoice = { id: string; name: string; parentId: string };

export type Choices = {
  workflows: WorkflowChoice[];
  roles: RoleChoice[];
  groups: GroupChoice[];
};

const stepOf = (item: Item): StepToFill => ({
  id: textOf(item, "id"),
  title: textOf(item, "title"),
  roleId: textOf(item, "role_id"),
  prompts: listOf(item.questions)
    .map((question) => textOf(question, "prompt"))
    .filter(Boolean),
  questions: listOf(item.questions)
    .filter((question) => textOf(question, "prompt") !== "")
    .map((question) => ({
      prompt: textOf(question, "prompt"),
      options: ["single_choice", "multi_select"].includes(
        textOf(question, "answer_type"),
      )
        ? textsOf(question.options)
        : [],
      optionsFrom: ["single_choice", "multi_select"].includes(
        textOf(question, "answer_type"),
      )
        ? textOf(question, "options_from")
        : "",
    })),
});

const pickedAs = (pickers: unknown, kind: string): RoleChoice[] =>
  isRecord(pickers)
    ? listOf(pickers.actors)
        .filter((actor) => textOf(actor, "kind") === kind)
        .map((actor) => ({ id: textOf(actor, "id"), name: textOf(actor, "name") }))
        .filter((choice) => choice.name !== "")
    : [];

export const loadChoices = async (hubId: string): Promise<Choices> => {
  const scope = await draftScope(hubId);
  const [workflows, items, pickers] = await Promise.all([
    callTool<unknown>(hubId, "agency_list_workflows", scope),
    callTool<unknown>(hubId, "agency_list_work_items", scope),
    callTool<unknown>(hubId, "agency_list_pickers", scope),
  ]);
  const steps = itemsOf(items);
  return {
    workflows: itemsOf(workflows).map((workflow) => ({
      id: textOf(workflow, "id"),
      name: textOf(workflow, "name"),
      steps: steps
        .filter(
          (step) => textOf(step, "workflow_id") === textOf(workflow, "id"),
        )
        .map(stepOf),
    })),
    roles: pickedAs(pickers, "role"),
    groups: pickedAs(pickers, "group").map((group) => ({
      ...group,
      parentId: "",
    })),
  };
};

export const runScenarios = async (
  hubId: string,
  scenarioIds: string[],
): Promise<void> => {
  const draftId = await workingDraftId(hubId);
  await callTool(hubId, "agency_run_scenarios", {
    draft_id: draftId,
    scenario_ids: scenarioIds,
  });
};

export const runOne = async (
  hubId: string,
  scenarioId: string,
): Promise<string> =>
  textOf(
    await callTool<unknown>(hubId, "agency_run_scenario", {
      scenario_id: scenarioId,
    }),
    "id",
  );

const named = (value: string): string => {
  const name = value.trim();
  if (name === "") throw new Error("name is required");
  return name;
};

export const saveAddScenario = async (
  hubId: string,
  draft: NewScenario,
): Promise<ActionResult> => {
  const name = named(draft.name);
  if (draft.workflowId === "") throw new Error("workflow_id is required");
  await callTool(hubId, "agency_create_scenario", {
    draft_id: await workingDraft(hubId),
    name,
    summary: draft.summary.trim(),
    workflow_id: draft.workflowId,
    actors: draft.actors
      .filter((actor) => actor.name.trim() !== "")
      .map((actor) => ({ name: actor.name.trim(), role_id: actor.roleId })),
    inputs: draft.inputs
      .filter((input) => input.value.trim() !== "")
      .map((input) => ({
        step_id: input.stepId,
        field: input.field,
        value: input.value.trim(),
      })),
  });
  return "done";
};
