import { groupKept } from "../../groupEdit";
import { groupsOfType } from "../../groupsOfType";
import { listOf, text } from "./councilData";

const groupList = "actor_list_groups";

const leaderList = "actor_list_group_leaders";

const chairNamesOf = async (groupId: string) => {
  const leaders = await listOf(leaderList, { group_id: groupId });
  return leaders.map((leader) => text(leader, "display_name")).filter((name) => name !== "").join(", ");
};

export const loadCommittees = async () => {
  const groups = await groupsOfType("Committee");
  return Promise.all(
    groups.map(async (group) => {
      const chairNames = await chairNamesOf(text(group, "id"));
      return { id: text(group, "id"), name: text(group, "name"), chair: chairNames === "" ? "" : `Chair: ${chairNames}`, chairNames, ...groupKept(group) };
    }),
  );
};

export const loadCommittee = async (id: string) => (await loadCommittees()).find((committee) => committee.id === id) ?? { id, name: "", chair: "", chairNames: "", ...groupKept({}) };

export const committeesTool = groupList;
