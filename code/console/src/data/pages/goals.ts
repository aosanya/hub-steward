import type { PageRow } from "../../types";
import { callTool } from "../../wakala/mcp";
import { draftScope } from "../draft";
import type { ActionResult, ActionRun, PageModule, Query } from "../types";

type Item = Record<string, unknown>;

const isRecord = (value: unknown): value is Item => typeof value === "object" && value !== null && !Array.isArray(value);

const text = (value: unknown) => (typeof value === "string" ? value : "");

const trimmed = (values: Item, key: string) => text(values[key]).trim();

const itemsOf = (answer: unknown): Item[] => {
  const list = Array.isArray(answer) ? answer : isRecord(answer) && Array.isArray(answer.items) ? answer.items : [];
  return list.filter(isRecord);
};

const goalRows = async (hubId: string, query: Query): Promise<PageRow[]> => {
  const scope = await draftScope(hubId, query);
  const [goals, objectives] = await Promise.all([
    callTool<unknown>(hubId, "agency_list_goals", scope),
    callTool<unknown>(hubId, "agency_list_objectives", scope),
  ]);
  const counts = new Map<string, number>();
  for (const objective of itemsOf(objectives)) {
    const goalId = text(objective.goal_id);
    counts.set(goalId, (counts.get(goalId) ?? 0) + 1);
  }
  return itemsOf(goals).map((goal) => {
    const id = text(goal.id);
    return { id, code: text(goal.code), title: text(goal.title), objectives: counts.get(id) ?? 0 };
  });
};

const objectiveRows = async (hubId: string, goalId: string, query: Query): Promise<PageRow[]> => {
  await callTool<unknown>(hubId, "agency_get_goal", { goal_id: goalId });
  const objectives = await callTool<unknown>(hubId, "agency_list_objectives", await draftScope(hubId, query));
  return itemsOf(objectives)
    .filter((objective) => {
      const owner = text(objective.goal_id);
      return owner === "" || owner === goalId;
    })
    .map((objective) => ({ id: text(objective.id), code: text(objective.code), title: text(objective.title), goal_id: goalId }));
};

export type GoalDetail = { id: string; code: string; title: string; description: string };

export type ObjectiveDetail = GoalDetail & { goalId: string };

const recordOf = (answer: unknown, key: string): Item => {
  if (!isRecord(answer)) return {};
  return isRecord(answer[key]) ? answer[key] : answer;
};

export const goalDetail = async (hubId: string, goalId: string): Promise<GoalDetail> => {
  const item = recordOf(await callTool<unknown>(hubId, "agency_get_goal", { goal_id: goalId }), "goal");
  return { id: text(item.id) || goalId, code: text(item.code), title: text(item.title), description: text(item.description) };
};

export const objectiveDetail = async (hubId: string, objectiveId: string): Promise<ObjectiveDetail> => {
  const item = recordOf(await callTool<unknown>(hubId, "agency_get_objective", { objective_id: objectiveId }), "objective");
  return {
    id: text(item.id) || objectiveId,
    code: text(item.code),
    title: text(item.title),
    description: text(item.description),
    goalId: text(item.goal_id),
  };
};

const rows = async (hubId: string, query: Query): Promise<PageRow[]> => {
  if (query.goal) return objectiveRows(hubId, query.goal, query);
  return goalRows(hubId, query);
};

const propose = async (hubId: string, kind: string, summary: string, payload: Item): Promise<ActionResult> => {
  await callTool(hubId, "agency_propose_write", { kind, summary, payload: JSON.stringify(payload) });
  return "accepted";
};

const addGoal: ActionRun = async (hubId, values) => {
  const title = trimmed(values, "title");
  if (!title) throw new Error("title is required");
  return propose(hubId, "agency_create_goal", "Add the goal " + title, { title, description: trimmed(values, "description") });
};

export const goalsPage: PageModule = {
  spec: {
    id: "goals",
    title: "Goals",
    primary: "Add a goal",
    tools: [
      "agency_list_goals",
      "agency_list_objectives",
      "agency_get_goal",
      "agency_list_workflows",
      "agency_list_workflow_objectives",
      "agency_list_work_items",
      "agency_list_role_assignments_for_work_item",
      "agency_create_goal",
      "agency_create_objective",
      "agency_link_workflow_objective",
    ],
    columns: [
      { key: "code", label: "Code" },
      { key: "title", label: "Goal" },
      { key: "objectives", label: "Objectives" },
    ],
  },
  rows,
  actions: { goals: addGoal },
};
