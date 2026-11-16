import { groupKept } from "../staff/GroupEdit";
import { groupsOfType } from "../../groupsOfType";
import { listOf, text } from "./councilData";

const groupList = "actor_list_groups";

const leaderList = "actor_list_group_leaders";

const chairOf = async (groupId: string) => {
  const leaders = await listOf(leaderList, { group_id: groupId });
  const names = leaders.map((leader) => text(leader, "display_name")).filter((name) => name !== "");
  return names.length === 0 ? "" : `Chair: ${names.join(", ")}`;
};

export const loadCommittees = async () => {
  const groups = await groupsOfType("Committee");
  return Promise.all(groups.map(async (group) => ({ id: text(group, "id"), name: text(group, "name"), chair: await chairOf(text(group, "id")), ...groupKept(group) })));
};

export const loadCommittee = async (id: string) => (await loadCommittees()).find((committee) => committee.id === id) ?? { id, name: "", chair: "", ...groupKept({}) };

export const committeesTool = groupList;
