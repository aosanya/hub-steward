import { useState } from "react";
import { useWord } from "../../../../features/agency/useWord";
import { MenuWindow } from "../../MenuWindow";
import { groupsOfType } from "../../groupsOfType";
import { callTool } from "../../../../shared/wakala/mcp";
import { GroupEdit, groupKept } from "./GroupEdit";
import { homeEmpty, peopleWords, text, type Item } from "./staffData";

const headCountOf = async (group: Item) => {
  const reply = await callTool("", "actor_get_group_population", { group_id: text(group, "id") }).catch(() => null);
  const population = (reply as Item | null)?.population;
  return typeof population === "number" ? peopleWords(population) : "";
};

const loadDepartments = async () => {
  const groups = await groupsOfType("Department");
  return Promise.all(groups.map(async (group) => ({ id: text(group, "id"), name: text(group, "name"), meta: await headCountOf(group), ...groupKept(group) })));
};

const loadDepartment = async (id: string) => (await loadDepartments()).find((department) => department.id === id) ?? { id, name: "", meta: "", ...groupKept({}) };

export function DepartmentsScreen() {
  const word = useWord("actor");
  const [version, setVersion] = useState(0);
  return (
    <MenuWindow
      title={word("Departments")}
      listKey={version}
      detailKey={version}
      list={{ title: word("Departments"), tool: "actor_list_groups", load: loadDepartments, fields: { title: "name", meta: "meta" }, empty: homeEmpty(`No ${word("Departments").toLowerCase()} yet.`) }}
      detail={{ tool: "actor_get_group_population", load: loadDepartment, fields: { Name: "name", "Head count": "meta" }, status: "status", extra: (department) => <GroupEdit group={department} onSaved={() => setVersion((was) => was + 1)} /> }}
    />
  );
}
