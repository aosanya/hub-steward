import { itemsOf } from "../../../../features/backlogs";
import { callTool } from "../../../../shared/wakala/mcp";
import { MenuWindow } from "../../MenuWindow";

const populationOf = async (groupId: string) => {
  const reply = (await callTool("", "actor_get_group_population", { group_id: groupId })) as { population?: unknown } | null;
  return typeof reply?.population === "number" ? `${reply.population} residents` : "";
};

const loadAreas = async () => {
  const groups = itemsOf(await callTool("", "actor_list_groups"));
  return Promise.all(groups.map(async (group) => ({ id: group.id, name: group.name, residents: await populationOf(group.id) })));
};

const loadArea = async (id: string) => ({ id, residents: await populationOf(id) });

export function BoundariesAndAreas() {
  return (
    <MenuWindow
      title="Boundaries & Areas"
      list={{ title: "Boundaries & Areas", tool: "actor_list_groups", load: loadAreas, fields: { title: "name", meta: "residents" }, empty: { words: "No areas have been added yet." } }}
      detail={{ tool: "actor_get_group_population", load: loadArea, fields: { Residents: "residents" }, status: "status" }}
    />
  );
}
