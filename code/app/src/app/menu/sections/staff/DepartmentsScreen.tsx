import { useSearchParams } from "react-router-dom";
import { useWord } from "../../../../features/agency/useWord";
import { AddButton } from "../../AddButton";
import { MenuWindow } from "../../MenuWindow";
import { groupsOfType } from "../../groupsOfType";
import { callTool } from "../../../../shared/wakala/mcp";
import { ChatAboutGroup } from "../residents/ChatAboutGroup";
import { StaffGroupPage, loadStaffGroup } from "./StaffGroupPage";
import { staffPaths } from "./paths";
import { homeEmpty, peopleWords, text, type Item } from "./staffData";

const headCountOf = async (group: Item) => {
  const reply = await callTool("", "actor_get_group_population", { group_id: text(group, "id") }).catch(() => null);
  const population = (reply as Item | null)?.population;
  return typeof population === "number" ? peopleWords(population) : "";
};

const loadDepartments = async () => {
  const groups = await groupsOfType("Department");
  return Promise.all(groups.map(async (group) => ({ id: text(group, "id"), name: text(group, "name"), meta: await headCountOf(group) })));
};

export function DepartmentsScreen() {
  const word = useWord("actor");
  const [search] = useSearchParams();
  return (
    <MenuWindow
      title={word("Departments")}
      withTabs
      bandless
      startAt={search.get("group") ?? undefined}
      above={<AddButton permission="group.manage" label={`Add ${word("Department").toLowerCase()}`} to={staffPaths.departmentNew.path()} />}
      list={{ title: word("Departments"), tool: "actor_list_groups", load: loadDepartments, fields: { title: "name", meta: "meta" }, empty: homeEmpty(`No ${word("Departments").toLowerCase()} yet.`) }}
      detail={{
        tool: "actor_get_group",
        load: loadStaffGroup("department"),
        fields: {},
        status: "",
        extra: (group) => (
          <>
            <ChatAboutGroup group={group} back={staffPaths.departments.path()} />
            <StaffGroupPage group={group} word={word("Department")} editPath={staffPaths.departmentEdit.path({ id: text(group, "id") })} />
          </>
        ),
      }}
    />
  );
}
