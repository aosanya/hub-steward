import { draftScope, type DraftScope } from "../../data/draft";
import { rolesPage } from "../../data/pages/roles";
import { itemsOf, textOf, type Item } from "../../data/pages/groups";
import type { Query } from "../../data/types";
import { callTool } from "../../wakala/mcp";
import {
  readWorkflowLists,
  workflowsByObjective,
  type ObjectiveWorkflow,
} from "./objectivesData";

export type StepRole = {
  roleId: string;
  name: string;
  ai: boolean;
};

export type WorkflowRef = { id: string; code: string; name: string };

export type ObjectiveStep = {
  id: string;
  code: string;
  name: string;
  workflow: WorkflowRef;
  roles: StepRole[];
};

export type ObjectiveFlow = {
  workflows: ObjectiveWorkflow[];
  steps: ObjectiveStep[];
};

export type RoleDirectory = Map<string, { name: string; ai: boolean }>;

export const roleDirectory = async (
  hubId: string,
  scope: DraftScope,
): Promise<RoleDirectory> =>
  new Map(
    (await rolesPage.rows(hubId, scope as Query)).map((role) => [
      textOf(role, "id"),
      { name: textOf(role, "name"), ai: textOf(role, "kind") === "ai" },
    ]),
  );

export const rolesOnStep = (
  step: Item,
  directory: RoleDirectory,
): StepRole[] => {
  const roleId = textOf(step, "accountable_role_id") || textOf(step, "role_id");
  const role = directory.get(roleId);
  return role ? [{ roleId, name: role.name, ai: role.ai }] : [];
};

const byOrdinality = (a: Item, b: Item): number =>
  (Number(a.ordinality) || 0) - (Number(b.ordinality) || 0);

export const loadObjectiveFlow = async (
  hubId: string,
  objectiveId: string,
  query: Query = {},
): Promise<ObjectiveFlow> => {
  const scope = await draftScope(hubId, query);
  const [lists, directory] = await Promise.all([
    readWorkflowLists(hubId, scope),
    roleDirectory(hubId, scope),
  ]);
  const workflows = workflowsByObjective(lists).get(objectiveId) ?? [];
  const stepItems = workflows.flatMap((workflow) =>
    lists.workItems
      .filter((item) => textOf(item, "workflow_id") === workflow.id)
      .sort(byOrdinality)
      .map((item) => ({ item, workflow })),
  );
  const steps = stepItems.map(({ item, workflow }) => ({
    id: textOf(item, "id"),
    code: textOf(item, "code"),
    name: textOf(item, "title"),
    workflow: { id: workflow.id, code: workflow.code, name: workflow.name },
    roles: rolesOnStep(item, directory),
  }));
  return { workflows, steps };
};
