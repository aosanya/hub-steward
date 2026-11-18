import { ListRow } from "../../../../shared/ui/ListRow";
import { Section } from "../../../../shared/ui/Section";
import { SectionGo } from "../residents/SectionAct";
import { GroupHead, loadGroup } from "../residents/GroupScreen";
import { populationFigure } from "../../populationFigure";
import { listOf, peopleWords, text, type Item } from "./staffData";

const leadersWords = (leaders: Item[]) => {
  const names = leaders.map((leader) => text(leader, "display_name")).filter((name) => name !== "");
  return names.length === 0 ? "" : names.join(", ");
};

export const loadStaffGroup = (kind: "department" | "crew") => async (id: string): Promise<Item> => {
  const group = await loadGroup(id);
  const count = await populationFigure(id);
  const withCount = { ...group, headcount: count === null ? "" : peopleWords(count) };
  if (kind === "department") return withCount;
  const leaders = await listOf("actor_list_group_leaders", { group_id: id }).catch(() => []);
  return { ...withCount, leaders: leadersWords(leaders) };
};

export function StaffGroupPage({ group, word, editPath }: { group: Item; word: string; editPath: string }) {
  const rows = [
    <ListRow key="name" title="Name" meta={text(group, "name")} />,
    ...(text(group, "headcount") ? [<ListRow key="members" title="Head count" meta={text(group, "headcount")} />] : []),
    ...(text(group, "leaders") ? [<ListRow key="leaders" title="Leaders" meta={text(group, "leaders")} />] : []),
  ];
  return (
    <div className="person-page">
      <GroupHead group={group} />
      <div className="sections">
        <Section word={`${word} detail`} plain foot={<SectionGo permission="group.manage" act="Edit" to={editPath} />} rows={rows} />
      </div>
    </div>
  );
}
