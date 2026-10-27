import type { PageRow } from "../../types";
import { callTool } from "../../wakala/mcp";
import { draftScope } from "../draft";
import type { ActionResult, ActionRun, PageModule, Query } from "../types";

export type Item = Record<string, unknown>;

export const isRecord = (value: unknown): value is Item => typeof value === "object" && value !== null && !Array.isArray(value);

export const textOf = (record: unknown, key: string): string => {
  const value = isRecord(record) ? record[key] : undefined;
  return typeof value === "string" ? value : "";
};

export const itemsOf = (answer: unknown): Item[] => {
  const list = Array.isArray(answer) ? answer : isRecord(answer) && Array.isArray(answer.items) ? answer.items : [];
  return list.filter(isRecord);
};

export const trimmedValue = (values: Item, key: string): string => {
  const value = values[key];
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") throw new Error("that was not understood");
  return value.trim();
};

export const proposeWrite = async (hubId: string, kind: string, summary: string, payload: Record<string, unknown>): Promise<ActionResult> => {
  await callTool(hubId, "agency_propose_write", { kind, summary, payload: JSON.stringify(payload) });
  return "accepted";
};

const joinModeLabels: Record<string, string> = { open: "Open", confirmed: "Approval required" };

export const joinOpenWord = joinModeLabels.open;

const joinModePhrases: Record<string, string> = { open: "open to anyone", confirmed: "approval required" };

const joinModeLabel = (stored: string) => (Object.hasOwn(joinModeLabels, stored) ? joinModeLabels[stored] : stored);

const integerCounts = (value: unknown): Record<string, number> | null =>
  isRecord(value) && Object.values(value).every((count) => Number.isInteger(count)) ? (value as Record<string, number>) : null;

const countsOf = (answer: unknown): Record<string, number> => {
  const plain = integerCounts(answer);
  if (plain) return plain;
  if (!isRecord(answer)) return {};
  return integerCounts(answer.counts) ?? integerCounts(answer.items) ?? {};
};

const aiRoleOf = (group: Item, roleNames: Map<string, string>): string => {
  const ref = textOf(group.attributes, "ai_role");
  if (!ref) return "";
  return roleNames.get(ref) ?? ref;
};

const groupList = async (hubId: string): Promise<PageRow[]> => {
  const [groups, homeCounts, roles] = await Promise.all([
    callTool<unknown>(hubId, "actor_list_groups", {}),
    callTool<unknown>(hubId, "actor_home_counts", {}),
    draftScope(hubId).then((scope) => callTool<unknown>(hubId, "agency_list_roles", scope)),
  ]);
  const counts = countsOf(homeCounts);
  const roleNames = new Map(itemsOf(roles).map((role) => [textOf(role, "id"), textOf(role, "name")]));
  return itemsOf(groups).map((group) => {
    const id = textOf(group, "id");
    return {
      id,
      group: textOf(group, "name"),
      members: Object.hasOwn(counts, id) ? counts[id] : 0,
      join_mode: joinModeLabel(textOf(group, "join_mode")),
      mode: textOf(group, "join_mode"),
      ai_role: aiRoleOf(group, roleNames),
    };
  });
};

const groupMembers = async (hubId: string, groupId: string): Promise<PageRow[]> => {
  const [group, roster] = await Promise.all([
    callTool<unknown>(hubId, "actor_get_group", { group_id: groupId }),
    callTool<unknown>(hubId, "actor_list_actors_for_group", { group_id: groupId }),
  ]);
  return itemsOf(roster).map((member) => ({
    group: textOf(group, "name"),
    member: textOf(member, "actor_id"),
    joined: textOf(member, "created_at"),
    join_mode: joinModeLabel(textOf(group, "join_mode")),
  }));
};

const groupCard = async (hubId: string, groupId: string): Promise<PageRow[]> => {
  const group = await callTool<unknown>(hubId, "actor_get_group", { group_id: groupId });
  return [{ id: groupId, group: textOf(group, "name"), join_mode: joinModeLabel(textOf(group, "join_mode")), mode: textOf(group, "join_mode") }];
};

const rows = async (hubId: string, query: Query): Promise<PageRow[]> => {
  if (query.card) return groupCard(hubId, query.card);
  return query.group ? groupMembers(hubId, query.group) : groupList(hubId);
};

const proposeJoinMode: ActionRun = async (hubId, values) => {
  const groupId = trimmedValue(values, "id");
  if (!groupId) throw new Error("group is required");
  const mode = trimmedValue(values, "join_mode");
  if (!Object.hasOwn(joinModePhrases, mode)) throw new Error("join mode must be open or confirmed");
  const name = trimmedValue(values, "group_name") || groupId;
  return proposeWrite(hubId, "actor_set_group_join_mode", "Make the " + name + " group " + joinModePhrases[mode], {
    group_id: groupId,
    join_mode: mode,
  });
};

const createGroup: ActionRun = async (hubId, values) => {
  const name = trimmedValue(values, "name");
  if (!name) throw new Error("name is required");
  return proposeWrite(hubId, "actor_create_group", "Create the group " + name, { name });
};

export const groupsPage: PageModule = {
  spec: {
    id: "groups",
    title: "Groups",
    primary: "Create a group",
    tools: [
      "actor_list_groups",
      "actor_home_counts",
      "agency_list_roles",
      "actor_get_group",
      "actor_list_actors_for_group",
      "actor_create_group",
      "actor_set_group_join_mode",
    ],
    columns: [
      { key: "group", label: "Group" },
      { key: "members", label: "Members" },
      { key: "join_mode", label: "Join mode" },
      { key: "ai_role", label: "AI role" },
    ],
  },
  rows,
  actions: { joinMode: proposeJoinMode, create: createGroup },
};
