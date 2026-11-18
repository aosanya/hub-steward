import { useWord } from "../../../../features/agency/useWord";
import { itemsOf } from "../../../../features/backlogs";
import { callTool } from "../../../../shared/wakala/mcp";
import { AddButton } from "../../AddButton";
import { MenuWindow } from "../../MenuWindow";
import { populationFigure } from "../../populationFigure";
import { SectionGo } from "../residents/SectionAct";
import { settingsPaths } from "./paths";
import { ChatAboutItem, text, useChosenItem } from "./RecordPage";
import { FactsCard } from "../../FactsCard";
import { HouseholdsCard } from "./HouseholdsCard";
import { PageFrame } from "../../PageFrame";
import { outerRingOf, textFromCorners } from "./boundary";

const populationOf = async (groupId: string) => {
  const figure = await populationFigure(groupId);
  return figure === null ? "" : `${figure} residents`;
};

const loadAreas = async () => {
  const groups = itemsOf(await callTool("", "actor_list_groups"));
  return Promise.all(groups.map(async (group) => ({ id: group.id, name: group.name, residents: await populationOf(group.id) })));
};

const groupOf = async (id: string) => {
  try {
    return (await callTool("", "actor_get_group", { group_id: id })) as Record<string, unknown> | null;
  } catch {
    return null;
  }
};

const cornersWords = (count: number) => (count === 0 ? "" : `${count} corner${count === 1 ? "" : "s"}`);

const loadArea = async (id: string) => {
  const [residents, group] = await Promise.all([populationOf(id), groupOf(id)]);
  const corners = textFromCorners(outerRingOf(group));
  const node = group?.area_node_id;
  return { id, name: typeof group?.name === "string" ? group.name : "", residents, area_node_id: typeof node === "string" ? node : "", corners, boundary: cornersWords(corners === "" ? 0 : corners.split("\n").length) };
};

const genericAreas = "Boundaries & Areas";

const areasInSentence = (listed: string) => (listed === genericAreas ? "areas" : listed.toLowerCase());

export function BoundariesAndAreas() {
  const word = useWord();
  const title = word(genericAreas);
  return (
    <MenuWindow
      title={title}
      withTabs
      bandless
      above={<AddButton permission="group.manage" label="Add area" to={settingsPaths.boundaryNew.path()} />}
      startAt={useChosenItem()}
      list={{ title, tool: "actor_list_groups", load: loadAreas, fields: { title: "name", meta: "residents" }, empty: { words: `No ${areasInSentence(title)} have been added yet.` } }}
      detail={{ tool: "actor_get_group_population", load: loadArea, fields: {}, status: "",
        extra: (area) => (
          <>
            <ChatAboutItem about={{ kind: "boundary", id: text(area, "id"), name: text(area, "name") }} back={settingsPaths.boundariesAndAreas.path()} />
            <PageFrame title={text(area, "name")} line={text(area, "residents")}>
              <FactsCard
                word="Boundary"
                facts={[["Residents", text(area, "residents")], ["Area node", text(area, "area_node_id")], ["Boundary", text(area, "boundary")]]}
                foot={<SectionGo permission="group.manage" act="Edit" to={settingsPaths.boundaryEdit.path({ id: text(area, "id") })} />}
              />
              <HouseholdsCard areaId={text(area, "id")} />
            </PageFrame>
          </>
        ),
      }}
    />
  );
}
