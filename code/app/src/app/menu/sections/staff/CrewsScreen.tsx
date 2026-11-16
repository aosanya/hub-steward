import { MenuWindow } from "../../MenuWindow";
import { homeEmpty, listOf, text, type Item } from "./staffData";

const leadersWords = (leaders: Item[]) => {
  const names = leaders.map((leader) => text(leader, "display_name")).filter((name) => name !== "");
  return names.length === 0 ? "" : `${names.length === 1 ? "Leader" : "Leaders"}: ${names.join(", ")}`;
};

const loadCrews = async () => {
  const groups = await listOf("actor_list_groups");
  return Promise.all(
    groups.map(async (group) => ({
      id: text(group, "id"),
      name: text(group, "name"),
      meta: leadersWords(await listOf("actor_list_group_leaders", { group_id: text(group, "id") }).catch(() => [])),
    })),
  );
};

const loadCrew = async (id: string) => (await loadCrews()).find((crew) => crew.id === id) ?? { id, name: "", meta: "" };

export function CrewsScreen() {
  return (
    <MenuWindow
      title="Crews"
      list={{ title: "Crews", tool: "actor_list_groups", load: loadCrews, fields: { title: "name", meta: "meta" }, empty: homeEmpty("No crews yet.") }}
      detail={{ tool: "actor_list_group_leaders", load: loadCrew, fields: { Name: "name", Leaders: "meta" }, status: "status" }}
    />
  );
}
