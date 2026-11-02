import { draftScope } from "../../data/draft";
import { itemsOf, textOf, type Item } from "../../data/pages/groups";
import type { Query } from "../../data/types";
import { callTool } from "../../wakala/mcp";
import {
  roleDirectory,
  rolesOnStep,
  type StepRole,
  type WorkflowRef,
} from "./objectiveFlowData";
import type { ObjectiveRef } from "./objectivesData";

export type StepDetail = {
  id: string;
  code: string;
  name: string;
  workflow: WorkflowRef | null;
  objectives: ObjectiveRef[];
  roles: StepRole[];
};

const workflowOf = async (
  hubId: string,
  workflowId: string,
): Promise<WorkflowRef | null> => {
  if (!workflowId) return null;
  const workflow = await callTool<Item>(hubId, "agency_get_workflow", {
    workflow_id: workflowId,
  });
  return {
    id: workflowId,
    code: textOf(workflow, "code"),
    name: textOf(workflow, "name"),
  };
};

const objectivesServedBy = async (
  hubId: string,
  workflowId: string,
  scope: Query,
): Promise<ObjectiveRef[]> => {
  if (!workflowId) return [];
  const [links, objectives] = await Promise.all([
    callTool<unknown>(hubId, "agency_list_workflow_objectives", {
      ...scope,
      workflow_id: workflowId,
    }),
    callTool<unknown>(hubId, "agency_list_objectives", scope),
  ]);
  const serving = new Set(
    itemsOf(links).map((link) => textOf(link, "objective_id")),
  );
  return itemsOf(objectives)
    .filter((objective) => serving.has(textOf(objective, "id")))
    .map((objective) => ({
      id: textOf(objective, "id"),
      code: textOf(objective, "code"),
    }));
};

export const loadStepDetail = async (
  hubId: string,
  stepId: string,
  query: Query = {},
): Promise<StepDetail> => {
  const scope = await draftScope(hubId, query);
  const step = await callTool<Item>(hubId, "agency_get_work_item", {
    work_item_id: stepId,
  });
  const workflowId = textOf(step, "workflow_id");
  const [workflow, objectives, directory] = await Promise.all([
    workflowOf(hubId, workflowId),
    objectivesServedBy(hubId, workflowId, scope as Query),
    roleDirectory(hubId, scope),
  ]);
  return {
    id: textOf(step, "id") || stepId,
    code: textOf(step, "code"),
    name: textOf(step, "title"),
    workflow,
    objectives,
    roles: await rolesOnStep(hubId, scope, stepId, directory),
  };
};
