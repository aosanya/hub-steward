import { draftScope } from "../../data/draft";
import {
  isRecord,
  itemsOf,
  textOf,
  trimmedValue,
  type Item,
} from "../../data/pages/groups";
import type { ActionRun } from "../../data/types";
import { callTool } from "../../wakala/mcp";
import type { OptionItem } from "../../types";
import type { Outcome } from "../spec/sendAction";

export const workflowOptions = async (hubId: string): Promise<OptionItem[]> => {
  const workflows = await callTool<unknown>(
    hubId,
    "agency_list_workflows",
    await draftScope(hubId, {}),
  );
  return itemsOf(workflows)
    .map((workflow) => ({
      value: textOf(workflow, "id"),
      label: textOf(workflow, "name") || textOf(workflow, "id"),
    }))
    .filter((option) => option.value !== "");
};

const idOf = (made: unknown): string => {
  const item = isRecord(made) && isRecord(made.objective) ? made.objective : made;
  return textOf(item, "id");
};

export const addObjective: ActionRun = async (hubId, values) => {
  const goalId = trimmedValue(values, "goal_id");
  if (!goalId) throw new Error("goal is required");
  const title = trimmedValue(values, "title");
  if (!title) throw new Error("title is required");
  const workflowId = trimmedValue(values, "workflow_id");
  if (!workflowId) throw new Error("workflow is required");
  const measure = trimmedValue(values, "measure");
  const target = trimmedValue(values, "target");
  if (measure && !target) throw new Error("target is required");
  const scope = await draftScope(hubId);
  const objectiveId = idOf(
    await callTool<unknown>(hubId, "agency_create_objective", {
      ...scope,
      goal_id: goalId,
      title,
      description: trimmedValue(values, "description"),
    }),
  );
  if (!objectiveId) throw new Error("the objective was not given an id");
  await callTool(hubId, "agency_link_workflow_objective", {
    ...scope,
    objective_id: objectiveId,
    workflow_id: workflowId,
  });
  if (measure)
    await callTool(hubId, "agency_set_measure", {
      objective_id: objectiveId,
      name: measure,
      target,
    });
  return "done";
};

export const sendObjective = async (
  hubId: string,
  values: Item,
): Promise<Outcome> => {
  try {
    return await addObjective(hubId, values);
  } catch {
    return "failed";
  }
};
