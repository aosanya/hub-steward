import { MenuWindow } from "../../MenuWindow";
import { homeEmpty, listOf, peopleWords, text, type Item } from "./staffData";

const liveDraftOf = async () => {
  const production = (await listOf("agency_list_publications")).filter((publication) => publication.channel === "production");
  const newest = production.sort((a, b) => Number(b.version ?? 0) - Number(a.version ?? 0))[0];
  return text(newest, "draft_id");
};

const loadRoles = async () => {
  const draft = await liveDraftOf();
  const [roles, assignments] = await Promise.all([listOf("agency_list_roles", { draft_id: draft }), listOf("agency_list_role_assignments", { draft_id: draft })]);
  return roles.map((role) => ({
    id: text(role, "id"),
    name: text(role, "name"),
    meta: peopleWords(assignments.filter((assignment) => text(assignment, "role_id") === text(role, "id")).length),
  }));
};

const loadRole = async (id: string) => (await loadRoles()).find((role) => role.id === id) ?? { id, name: "", meta: "" };

export function RolesPermissionsScreen() {
  return (
    <MenuWindow
      title="Roles & Permissions"
      list={{ title: "Roles & Permissions", tool: "agency_list_roles", load: loadRoles, fields: { title: "name", meta: "meta" }, empty: homeEmpty("No roles yet.") }}
      detail={{ tool: "agency_list_role_assignments", load: loadRole, fields: { Name: "name", Holders: "meta" }, status: "status" }}
    />
  );
}
