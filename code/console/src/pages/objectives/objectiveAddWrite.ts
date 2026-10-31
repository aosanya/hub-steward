import { draftScope } from "../../data/draft";
import {
  itemsOf,
  proposeWrite,
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

export const addObjective: ActionRun = async (hubId, values) => {
  const goalId = trimmedValue(values, "goal_id");
  if (!goalId) throw new Error("goal is required");
  const title = trimmedValue(values, "title");
  if (!title) throw new Error("title is required");
  const workflowId = trimmedValue(values, "workflow_id");
  if (!workflowId) throw new Error("workflow is required");
  const workflowName = trimmedValue(values, "workflow_name") || workflowId;
  const measure = trimmedValue(values, "measure");
  const target = trimmedValue(values, "target");
  if (measure && !target) throw new Error("target is required");
  const summary = [
    `Add the objective ${title}`,
    `served by ${workflowName}`,
    ...(measure ? [`measured by ${measure}`] : []),
  ].join(", ");
  return proposeWrite(hubId, "agency_create_objective", summary, {
    goal_id: goalId,
    title,
    description: trimmedValue(values, "description"),
    workflow: {
      tool: "agency_link_workflow_objective",
      workflow_id: workflowId,
    },
    ...(measure
      ? { measure: { tool: "agency_set_measure", name: measure, target } }
      : {}),
  });
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
