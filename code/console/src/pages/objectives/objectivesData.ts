import { measuresOn } from "../../data/features";
import { draftScope, type DraftScope } from "../../data/draft";
import {
  itemsOf,
  proposeWrite,
  textOf,
  trimmedValue,
  type Item,
} from "../../data/pages/groups";
import type { ActionRun, Query } from "../../data/types";
import { callTool } from "../../wakala/mcp";

export type Measure = {
  id: string;
  name: string;
  now: string;
  target: string;
  unit: string;
  status: string;
};

export type ObjectiveRef = { id: string; code: string };

export type ObjectiveWorkflow = {
  id: string;
  code: string;
  name: string;
  steps: number;
  objectives: ObjectiveRef[];
};

export type ObjectiveGoal = { id: string; code: string; title: string };

export type ObjectiveCard = {
  id: string;
  code: string;
  title: string;
  goal: ObjectiveGoal | null;
  workflows: ObjectiveWorkflow[];
  measures: Measure[];
};

const scalar = (item: Item, key: string): string => {
  const value = item[key];
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : "";
};

const measureOf = (item: Item): Measure => ({
  id: textOf(item, "id"),
  name: textOf(item, "name"),
  now: scalar(item, "current"),
  target: scalar(item, "target"),
  unit: textOf(item, "unit"),
  status: textOf(item, "status"),
});

export const measureProgress = (measure: Measure): string => {
  const unit = measure.unit ? ` ${measure.unit}` : "";
  const count = measure.now || "0";
  const reached = measure.target ? `${count} / ${measure.target}` : count;
  return `${reached}${unit}`;
};

export const measuresFor = async (
  hubId: string,
  objectiveId = "",
  query: Query = {},
): Promise<Measure[]> => {
  if (!measuresOn) return [];
  try {
    const scope = await draftScope(hubId, query);
    const answer = await callTool<unknown>(
      hubId,
      "agency_list_measures",
      objectiveId ? { ...scope, objective_id: objectiveId } : scope,
    );
    return itemsOf(answer)
      .filter(
        (item) => !objectiveId || textOf(item, "objective_id") === objectiveId,
      )
      .map(measureOf);
  } catch {
    return [];
  }
};

const measuresByObjective = async (
  hubId: string,
  query: Query,
): Promise<Map<string, Measure[]>> => {
  const grouped = new Map<string, Measure[]>();
  if (!measuresOn) return grouped;
  try {
    const scope = await draftScope(hubId, query);
    for (const item of itemsOf(
      await callTool<unknown>(hubId, "agency_list_measures", scope),
    )) {
      const owner = textOf(item, "objective_id");
      grouped.set(owner, [...(grouped.get(owner) ?? []), measureOf(item)]);
    }
  } catch {
    return new Map();
  }
  return grouped;
};

export type WorkflowLists = {
  objectives: Item[];
  links: Item[];
  workflows: Item[];
  workItems: Item[];
};

export const readWorkflowLists = async (
  hubId: string,
  scope: DraftScope,
  objectives?: Item[],
): Promise<WorkflowLists> => {
  const [listedObjectives, links, workflows, workItems] = await Promise.all([
    objectives ??
      callTool<unknown>(hubId, "agency_list_objectives", scope).then(itemsOf),
    callTool<unknown>(hubId, "agency_list_workflow_objectives", scope).then(
      itemsOf,
    ),
    callTool<unknown>(hubId, "agency_list_workflows", scope).then(itemsOf),
    callTool<unknown>(hubId, "agency_list_work_items", scope).then(itemsOf),
  ]);
  return { objectives: listedObjectives, links, workflows, workItems };
};

export const workflowsByObjective = ({
  objectives,
  links,
  workflows,
  workItems,
}: WorkflowLists): Map<string, ObjectiveWorkflow[]> => {
  const stepCounts = new Map<string, number>();
  for (const item of workItems) {
    const workflowId = textOf(item, "workflow_id");
    stepCounts.set(workflowId, (stepCounts.get(workflowId) ?? 0) + 1);
  }
  const objectiveById = new Map<string, ObjectiveRef>(
    objectives.map((objective) => [
      textOf(objective, "id"),
      { id: textOf(objective, "id"), code: textOf(objective, "code") },
    ]),
  );
  const servedBy = new Map<string, ObjectiveRef[]>();
  for (const link of links) {
    const workflowId = textOf(link, "workflow_id");
    const objectiveId = textOf(link, "objective_id");
    servedBy.set(workflowId, [
      ...(servedBy.get(workflowId) ?? []),
      objectiveById.get(objectiveId) ?? { id: objectiveId, code: "" },
    ]);
  }
  const workflowById = new Map(
    workflows.map((workflow) => [
      textOf(workflow, "id"),
      {
        id: textOf(workflow, "id"),
        code: textOf(workflow, "code"),
        name: textOf(workflow, "name"),
        steps: stepCounts.get(textOf(workflow, "id")) ?? 0,
        objectives: servedBy.get(textOf(workflow, "id")) ?? [],
      },
    ]),
  );
  const grouped = new Map<string, ObjectiveWorkflow[]>();
  for (const link of links) {
    const owner = textOf(link, "objective_id");
    const workflow = workflowById.get(textOf(link, "workflow_id"));
    if (!workflow) continue;
    grouped.set(owner, [...(grouped.get(owner) ?? []), workflow]);
  }
  return grouped;
};

export const workflowsOfObjective = async (
  hubId: string,
  objectiveId: string,
  query: Query = {},
): Promise<ObjectiveWorkflow[]> =>
  workflowsByObjective(
    await readWorkflowLists(hubId, await draftScope(hubId, query)),
  ).get(objectiveId) ?? [];

export const loadObjectiveCards = async (
  hubId: string,
  query: Query = {},
): Promise<ObjectiveCard[]> => {
  const scope = await draftScope(hubId, query);
  const [goals, objectives] = await Promise.all([
    callTool<unknown>(hubId, "agency_list_goals", scope),
    callTool<unknown>(hubId, "agency_list_objectives", scope),
  ]);
  const workflows = workflowsByObjective(
    await readWorkflowLists(hubId, scope, itemsOf(objectives)),
  );
  const goalById = new Map(
    itemsOf(goals).map((goal) => [textOf(goal, "id"), goal]),
  );
  const listed = itemsOf(objectives);
  const measures = await measuresByObjective(hubId, query);
  return listed.map((objective) => {
    const id = textOf(objective, "id");
    const goal = goalById.get(textOf(objective, "goal_id"));
    return {
      id,
      code: textOf(objective, "code"),
      title: textOf(objective, "title"),
      goal: goal
        ? {
            id: textOf(goal, "id"),
            code: textOf(goal, "code"),
            title: textOf(goal, "title"),
          }
        : null,
      workflows: workflows.get(id) ?? [],
      measures: measures.get(id) ?? [],
    };
  });
};

const cardRow = (card: ObjectiveCard) => ({
  id: card.id,
  code: card.code,
  title: card.title,
  goal: card.goal?.title ?? "",
  workflows: card.workflows
    .map((workflow) => `${workflow.code} ${workflow.name}`.trim())
    .join("; "),
  measure: card.measures
    .map((measure) => `${measure.name}: ${measureProgress(measure)}`)
    .join("; "),
});

export const objectiveRows = async (hubId: string, query: Query) =>
  (await loadObjectiveCards(hubId, query)).map(cardRow);

export const setMeasure: ActionRun = async (hubId, values) => {
  const objectiveId = trimmedValue(values, "objective_id");
  if (!objectiveId) throw new Error("objective is required");
  const name = trimmedValue(values, "name");
  if (!name) throw new Error("measure is required");
  const target = trimmedValue(values, "target");
  if (!target) throw new Error("target is required");
  const unit = trimmedValue(values, "unit");
  const label = trimmedValue(values, "objective_code") || objectiveId;
  const summary = `Set the measure of ${label}: ${name}, target ${target}${unit ? ` ${unit}` : ""}`;
  return proposeWrite(hubId, "agency_set_measure", summary, {
    objective_id: objectiveId,
    name,
    target,
    ...(unit ? { unit } : {}),
  });
};
