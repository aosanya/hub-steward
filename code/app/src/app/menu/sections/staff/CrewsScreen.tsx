import { useState } from "react";
import { useWord } from "../../../../features/agency/useWord";
import { groupsOfType } from "../../groupsOfType";
import { MenuWindow } from "../../MenuWindow";
import { GroupEdit, groupKept } from "./GroupEdit";
import { homeEmpty, listOf, text, type Item } from "./staffData";

const leadersWords = (leaders: Item[]) => {
  const names = leaders.map((leader) => text(leader, "display_name")).filter((name) => name !== "");
  return names.length === 0 ? "" : `${names.length === 1 ? "Leader" : "Leaders"}: ${names.join(", ")}`;
};

const loadCrews = async () => {
  const groups = await groupsOfType("Crew");
  return Promise.all(
    groups.map(async (group) => ({
      id: text(group, "id"),
      name: text(group, "name"),
      meta: leadersWords(await listOf("actor_list_group_leaders", { group_id: text(group, "id") }).catch(() => [])),
      ...groupKept(group),
    })),
  );
};

const loadCrew = async (id: string) => (await loadCrews()).find((crew) => crew.id === id) ?? { id, name: "", meta: "", ...groupKept({}) };

export function CrewsScreen() {
  const word = useWord("actor");
  const [version, setVersion] = useState(0);
  return (
    <MenuWindow
      title={word("Crews")}
      listKey={version}
      detailKey={version}
      list={{ title: word("Crews"), tool: "actor_list_groups", load: loadCrews, fields: { title: "name", meta: "meta" }, empty: homeEmpty(`No ${word("Crews").toLowerCase()} yet.`) }}
      detail={{ tool: "actor_list_group_leaders", load: loadCrew, fields: { Name: "name", Leaders: "meta" }, status: "status", extra: (crew) => <GroupEdit group={crew} onSaved={() => setVersion((was) => was + 1)} /> }}
    />
  );
}
