import { useWord } from "../../../../features/agency/useWord";
import { itemsOf } from "../../../../features/backlogs";
import { callTool } from "../../../../shared/wakala/mcp";
import { MenuWindow } from "../../MenuWindow";
import { populationFigure } from "../../populationFigure";

const populationOf = async (groupId: string) => {
  const figure = await populationFigure(groupId);
  return figure === null ? "" : `${figure} residents`;
};

const loadAreas = async () => {
  const groups = itemsOf(await callTool("", "actor_list_groups"));
  return Promise.all(groups.map(async (group) => ({ id: group.id, name: group.name, residents: await populationOf(group.id) })));
};

const loadArea = async (id: string) => ({ id, residents: await populationOf(id) });

const genericAreas = "Boundaries & Areas";

const areasInSentence = (listed: string) => (listed === genericAreas ? "areas" : listed.toLowerCase());

export function BoundariesAndAreas() {
  const word = useWord();
  const title = word(genericAreas);
  return (
    <MenuWindow
      title={title}
      list={{ title, tool: "actor_list_groups", load: loadAreas, fields: { title: "name", meta: "residents" }, empty: { words: `No ${areasInSentence(title)} have been added yet.` } }}
      detail={{ tool: "actor_get_group_population", load: loadArea, fields: { Residents: "residents" }, status: "status" }}
    />
  );
}
