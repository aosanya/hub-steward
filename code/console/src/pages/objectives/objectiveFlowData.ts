import { draftScope, type DraftScope } from "../../data/draft";
import { rolesPage } from "../../data/pages/roles";
import { itemsOf, textOf, type Item } from "../../data/pages/groups";
import { raciLabels, type RaciLabel } from "../../data/pages/stepRoles";
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
  labels: RaciLabel[];
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

export const labelLetter = (label: RaciLabel): string =>
  label.slice(0, 1).toUpperCase();

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

export const rolesOnStep = async (
  hubId: string,
  scope: DraftScope,
  stepId: string,
  directory: RoleDirectory,
): Promise<StepRole[]> => {
  const assignments = itemsOf(
    await callTool<unknown>(
      hubId,
      "agency_list_role_assignments_for_work_item",
      { ...scope, work_item_id: stepId },
    ),
  );
  const labelsByRole = new Map<string, Set<RaciLabel>>();
  for (const assignment of assignments) {
    const roleId = textOf(assignment, "role_id");
    const label = raciLabels.find(
      (word) => word === textOf(assignment, "label").toLowerCase(),
    );
    if (!directory.has(roleId) || !label) continue;
    labelsByRole.set(
      roleId,
      new Set([...(labelsByRole.get(roleId) ?? []), label]),
    );
  }
  return [...labelsByRole].map(([roleId, labels]) => ({
    roleId,
    name: directory.get(roleId)?.name ?? "",
    ai: directory.get(roleId)?.ai ?? false,
    labels: raciLabels.filter((label) => labels.has(label)),
  }));
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
  const steps = await Promise.all(
    stepItems.map(async ({ item, workflow }) => ({
      id: textOf(item, "id"),
      code: textOf(item, "code"),
      name: textOf(item, "title"),
      workflow: { id: workflow.id, code: workflow.code, name: workflow.name },
      roles: await rolesOnStep(hubId, scope, textOf(item, "id"), directory),
    })),
  );
  return { workflows, steps };
};
