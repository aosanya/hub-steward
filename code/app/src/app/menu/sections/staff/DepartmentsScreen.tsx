import { MenuWindow } from "../../MenuWindow";
import { callTool } from "../../../../shared/wakala/mcp";
import { homeEmpty, listOf, peopleWords, text, type Item } from "./staffData";

const headCountOf = async (group: Item) => {
  const reply = await callTool("", "actor_get_group_population", { group_id: text(group, "id") }).catch(() => null);
  const population = (reply as Item | null)?.population;
  return typeof population === "number" ? peopleWords(population) : "";
};

const loadDepartments = async () => {
  const groups = await listOf("actor_list_groups");
  return Promise.all(groups.map(async (group) => ({ id: text(group, "id"), name: text(group, "name"), meta: await headCountOf(group) })));
};

const loadDepartment = async (id: string) => (await loadDepartments()).find((department) => department.id === id) ?? { id, name: "", meta: "" };

export function DepartmentsScreen() {
  return (
    <MenuWindow
      title="Departments"
      list={{ title: "Departments", tool: "actor_list_groups", load: loadDepartments, fields: { title: "name", meta: "meta" }, empty: homeEmpty("No departments yet.") }}
      detail={{ tool: "actor_get_group_population", load: loadDepartment, fields: { Name: "name", "Head count": "meta" }, status: "status" }}
    />
  );
}
