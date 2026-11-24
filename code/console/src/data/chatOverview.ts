import { callTool } from "../wakala/mcp";
import { draftScope } from "./draft";
import { itemsOf, textOf, type Item } from "./pages/groups";

const byId = (items: Item[]) =>
  new Map(items.map((item) => [textOf(item, "id"), item]));

const label = (item: Item | undefined) =>
  [textOf(item, "code"), textOf(item, "title") || textOf(item, "name")]
    .filter(Boolean)
    .join(" ");

const accountableRoles = (
  workItems: Item[],
  roles: Map<string, Item>,
  stepIds: Set<string>,
) => {
  const names = workItems
    .filter((item) => stepIds.has(textOf(item, "id")))
    .map((item) => textOf(item, "accountable_role_id") || textOf(item, "role_id"))
    .filter(Boolean)
    .map((roleId) => textOf(roles.get(roleId), "name") || roleId);
  return names.length === 0 ? {} : { accountable: [...new Set(names)] };
};

const namesOf = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim().toLowerCase())
    : [];

export type OverviewFilter = { objectives?: unknown; roles?: unknown };

export async function objectivesOverview(
  hubId: string,
  filter: OverviewFilter = {},
): Promise<unknown> {
  const scope = await draftScope(hubId);
  const [goals, objectives, roles, workflows, workItems, links] =
    await Promise.all(
      [
        "agency_list_goals",
        "agency_list_objectives",
        "agency_list_roles",
        "agency_list_workflows",
        "agency_list_work_items",
        "agency_list_workflow_objectives",
      ].map(async (tool) =>
        itemsOf(await callTool<unknown>(hubId, tool, scope)),
      ),
    );
  const goalById = byId(goals);
  const roleById = byId(roles);
  const workflowById = byId(workflows);
  const wanted = namesOf(filter.objectives);
  const wantedRoles = namesOf(filter.roles);
  const chosen = objectives.filter(
    (objective) =>
      wanted.length === 0 ||
      wanted.includes(textOf(objective, "code").toLowerCase()) ||
      wanted.includes(textOf(objective, "id").toLowerCase()),
  );
  const shown = chosen.map((objective) => {
    const id = textOf(objective, "id");
    const workflowIds = new Set(
      links
        .filter((link) => textOf(link, "objective_id") === id)
        .map((link) => textOf(link, "workflow_id")),
    );
    const stepIds = new Set(
      workItems
        .filter((item) => workflowIds.has(textOf(item, "workflow_id")))
        .map((item) => textOf(item, "id")),
    );
    return {
      id,
      code: textOf(objective, "code"),
      title: textOf(objective, "title"),
      description: textOf(objective, "description"),
      goal: label(goalById.get(textOf(objective, "goal_id"))),
      roles: accountableRoles(workItems, roleById, stepIds),
      workflows: [...workflowIds]
        .map((workflowId) => textOf(workflowById.get(workflowId), "name"))
        .filter(Boolean),
    };
  });
  const holds = (entry: { roles: Record<string, string[]> }) =>
    Object.values(entry.roles).some((names) =>
      names.some((name) => wantedRoles.includes(name.toLowerCase())),
    );
  return { objectives: wantedRoles.length === 0 ? shown : shown.filter(holds) };
}
