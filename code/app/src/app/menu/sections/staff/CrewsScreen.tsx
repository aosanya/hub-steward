import { useSearchParams } from "react-router-dom";
import { useWord } from "../../../../features/agency/useWord";
import { groupsOfType } from "../../groupsOfType";
import { AddButton } from "../../AddButton";
import { MenuWindow } from "../../MenuWindow";
import { ChatAboutGroup } from "../residents/ChatAboutGroup";
import { StaffGroupPage, loadStaffGroup } from "./StaffGroupPage";
import { staffPaths } from "./paths";
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
    })),
  );
};

export function CrewsScreen() {
  const word = useWord("actor");
  const [search] = useSearchParams();
  return (
    <MenuWindow
      title={word("Crews")}
      withTabs
      bandless
      startAt={search.get("group") ?? undefined}
      above={<AddButton permission="group.manage" label={`Add ${word("Crew").toLowerCase()}`} to={staffPaths.crewNew.path()} />}
      list={{ title: word("Crews"), tool: "actor_list_groups", load: loadCrews, fields: { title: "name", meta: "meta" }, empty: homeEmpty(`No ${word("Crews").toLowerCase()} yet.`) }}
      detail={{
        tool: "actor_list_group_leaders",
        load: loadStaffGroup("crew"),
        fields: {},
        status: "",
        extra: (group) => (
          <>
            <ChatAboutGroup group={group} back={staffPaths.crews.path()} />
            <StaffGroupPage group={group} word={word("Crew")} editPath={staffPaths.crewEdit.path({ id: text(group, "id") })} />
          </>
        ),
      }}
    />
  );
}
