import type { PageRow } from "../../types";
import { callTool } from "../../wakala/mcp";
import { draftScope } from "../draft";
import type { ActionRun, PageModule, Query } from "../types";
import { agentPermission } from "./agents";
import { isRecord, textOf, trimmedValue, type Item } from "./groups";

const roleItems = (answer: unknown): Item[] => {
  if (answer === null || answer === undefined) return [];
  if (Array.isArray(answer)) return answer.filter(isRecord);
  if (isRecord(answer) && Array.isArray(answer.items)) return answer.items.filter(isRecord);
  throw new Error("the answer was not a list");
};

const roleOf = (answer: unknown): Item | null => {
  if (answer === null || answer === undefined) return null;
  if (isRecord(answer)) return answer;
  throw new Error("the answer was not a role");
};

const permissionsOf = (item: Item | null): string[] =>
  item && Array.isArray(item.permissions) ? item.permissions.filter((code): code is string => typeof code === "string") : [];

const holdsAgentPermission = (item: Item): boolean => permissionsOf(item).includes(agentPermission);

const roleList = async (hubId: string, query: Query): Promise<PageRow[]> => {
  const items = roleItems(await callTool<unknown>(hubId, "agency_list_roles", await draftScope(hubId, query)));
  return items.map((item) => ({ ...item, kind: textOf(item, "kind") || (holdsAgentPermission(item) ? "ai" : "human") }));
};

const roleDetail = async (hubId: string, roleId: string, query: Query): Promise<PageRow[]> => {
  const scope = await draftScope(hubId, query);
  const [role, rules] = await Promise.all([
    callTool<unknown>(hubId, "agency_get_role", { role_id: roleId }),
    callTool<unknown>(hubId, "agency_list_rules", { ...scope, role_id: roleId }),
  ]);
  return [
    {
      role: roleOf(role),
      rules: roleItems(rules),
      members: null,
    },
  ];
};

export const objectiveCodes = async (hubId: string): Promise<Record<string, string>> => {
  const objectives = roleItems(await callTool<unknown>(hubId, "agency_list_objectives", await draftScope(hubId)));
  return Object.fromEntries(objectives.map((objective) => [textOf(objective, "id"), textOf(objective, "code")]));
};

export type RoleAgent = { id: string; name: string };

export const roleAgents = async (hubId: string, roleId: string): Promise<RoleAgent[]> =>
  roleItems(await callTool<unknown>(hubId, "ai_list_roles", {}))
    .filter((agent) => textOf(agent, "agency_role_id") === roleId)
    .map((agent) => ({ id: textOf(agent, "id"), name: textOf(agent, "name") }));

export const unlinkedAgents = async (hubId: string): Promise<RoleAgent[]> =>
  roleItems(await callTool<unknown>(hubId, "ai_list_roles", {}))
    .filter((agent) => textOf(agent, "agency_role_id") === "")
    .map((agent) => ({ id: textOf(agent, "id"), name: textOf(agent, "name") }));

const rows = async (hubId: string, query: Query): Promise<PageRow[]> =>
  query.role ? roleDetail(hubId, query.role, query) : roleList(hubId, query);

const addRole: ActionRun = async (hubId, values) => {
  const name = trimmedValue(values, "name");
  if (!name) throw new Error("name is required");
  await callTool(hubId, "agency_create_role", { ...(await draftScope(hubId)), description: trimmedValue(values, "description"), name });
  return "done";
};

const editRole: ActionRun = async (hubId, values) => {
  const roleId = trimmedValue(values, "role_id");
  const name = trimmedValue(values, "name");
  if (!roleId) throw new Error("role_id is required");
  if (!name) throw new Error("name is required");
  const held = roleOf(await callTool<unknown>(hubId, "agency_get_role", { role_id: roleId }));
  const others = permissionsOf(held).filter((code) => code !== agentPermission);
  const permissions = values.agent === true ? [...others, agentPermission] : others;
  await callTool(hubId, "agency_update_role", {
    ...(await draftScope(hubId)),
    role_id: roleId,
    name,
    description: trimmedValue(values, "description"),
    permissions,
    staff: held?.staff === true,
  });
  return "done";
};

export const rolesPage: PageModule = {
  spec: {
    id: "roles",
    title: "Roles",
    primary: "Add a role",
    tools: [
      "agency_create_role",
      "agency_update_role",
      "agency_delete_role",
      "agency_list_scenarios",
      "agency_list_roles",
      "agency_get_role",
      "agency_list_rules",
      "agency_list_objectives",
    ],
    columns: [
      { key: "code", label: "Code" },
      { key: "name", label: "Role" },
      { key: "kind", label: "Kind" },
      { key: "description", label: "What it does" },
    ],
  },
  rows,
  actions: { roles: addRole, role: editRole },
};
