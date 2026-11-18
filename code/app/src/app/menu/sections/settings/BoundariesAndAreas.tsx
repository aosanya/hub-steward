import { useState } from "react";
import { useWord } from "../../../../features/agency/useWord";
import { itemsOf } from "../../../../features/backlogs";
import { callTool } from "../../../../shared/wakala/mcp";
import { MenuEditForm } from "../../MenuEditForm";
import { MenuWindow } from "../../MenuWindow";
import { populationFigure } from "../../populationFigure";
import { BoundaryForm } from "./BoundaryForm";
import { settingsPaths } from "./paths";
import { ChatAboutItem, FactsCard, RecordPage, text, useChosenItem } from "./RecordPage";
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

const areaFields = [{ label: "Area node", key: "area_node_id" }];

const genericAreas = "Boundaries & Areas";

const areasInSentence = (listed: string) => (listed === genericAreas ? "areas" : listed.toLowerCase());

export function BoundariesAndAreas() {
  const word = useWord();
  const title = word(genericAreas);
  const [version, setVersion] = useState(0);
  const saved = () => setVersion((was) => was + 1);
  return (
    <MenuWindow
      title={title}
      withTabs
      bandless
      startAt={useChosenItem()}
      listKey={version}
      detailKey={version}
      list={{ title, tool: "actor_list_groups", load: loadAreas, fields: { title: "name", meta: "residents" }, empty: { words: `No ${areasInSentence(title)} have been added yet.` } }}
      detail={{ tool: "actor_get_group_population", load: loadArea, fields: {}, status: "",
        extra: (area) => (
          <>
            <ChatAboutItem about={{ kind: "boundary", id: text(area, "id"), name: text(area, "name") }} back={settingsPaths.boundariesAndAreas.path()} />
            <RecordPage name={text(area, "name")} line={text(area, "residents")}>
              <FactsCard word="Boundary" facts={[["Residents", text(area, "residents")], ["Area node", text(area, "area_node_id")], ["Boundary", text(area, "boundary")]]} />
              <MenuEditForm item={area} id={String(area.id)} idArg="group_id" tool="actor_set_group_area_node" permission="group.manage" fields={areaFields} onSaved={saved} />
              <BoundaryForm groupId={String(area.id)} shown={String(area.corners ?? "")} onSaved={saved} />
            </RecordPage>
          </>
        ),
      }}
    />
  );
}
