import { itemsOf } from "../../../../features/backlogs";
import { callTool } from "../../../../shared/wakala/mcp";

type Item = Record<string, unknown>;

const groupList = "actor_list_groups";

const leaderList = "actor_list_group_leaders";

const text = (item: Item | null | undefined, key: string) => {
  const value = item?.[key];
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
};

const listOf = async (tool: string, args?: Record<string, unknown>) => itemsOf(await callTool("", tool, args)) as Item[];

const chairOf = async (groupId: string) => {
  const leaders = await listOf(leaderList, { group_id: groupId });
  const names = leaders.map((leader) => text(leader, "display_name")).filter((name) => name !== "");
  return names.length === 0 ? "" : `Chair: ${names.join(", ")}`;
};

export const loadCommittees = async () => {
  const groups = await listOf(groupList);
  return Promise.all(groups.map(async (group) => ({ id: text(group, "id"), name: text(group, "name"), chair: await chairOf(text(group, "id")) })));
};

export const loadCommittee = async (id: string) => (await loadCommittees()).find((committee) => committee.id === id) ?? { id, name: "", chair: "" };

export const committeesTool = groupList;
