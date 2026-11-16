import { useState } from "react";
import { useWord } from "../../../../features/agency/useWord";
import { MenuWindow } from "../../MenuWindow";
import { RolePermissions } from "./RolePermissions";
import { homeEmpty, listOf, peopleWords, text, type Item } from "./staffData";

const liveDraftOf = async () => {
  const production = (await listOf("agency_list_publications")).filter((publication) => publication.channel === "production");
  const newest = production.sort((a, b) => Number(b.version ?? 0) - Number(a.version ?? 0))[0];
  return text(newest, "draft_id");
};

const holdersOf = async (kind: Item) => {
  const seats = await listOf("actor_list_role_holders", { kind_id: text(kind, "id") });
  const standing = seats.filter((seat) => seat.active !== false && text(seat, "ended_at") === "");
  return new Set(standing.map((seat) => text(seat, "actor_id"))).size;
};

const loadRoles = async () => {
  const draft = await liveDraftOf();
  const [roles, kinds] = await Promise.all([listOf("agency_list_roles", { draft_id: draft }), listOf("actor_list_role_kinds")]);
  const counts = new Map(await Promise.all(kinds.map(async (kind) => [text(kind, "definition_role_id"), await holdersOf(kind)] as const)));
  return roles.map((role) => ({
    id: text(role, "id"),
    name: text(role, "name"),
    meta: peopleWords(counts.get(text(role, "code")) ?? 0),
    permissions: Array.isArray(role.permissions) ? role.permissions : [],
  }));
};

const loadRole = async (id: string) => (await loadRoles()).find((role) => role.id === id) ?? { id, name: "", meta: "", permissions: [] };

export function RolesPermissionsScreen() {
  const word = useWord("actor");
  const [version, setVersion] = useState(0);
  return (
    <MenuWindow
      title={word("Roles & Permissions")}
      listKey={version}
      detailKey={version}
      list={{ title: word("Roles & Permissions"), tool: "agency_list_roles", load: loadRoles, fields: { title: "name", meta: "meta" }, empty: homeEmpty(`No ${word("Roles").toLowerCase()} yet.`) }}
      detail={{ tool: "actor_list_role_holders", load: loadRole, fields: { Name: "name", Holders: "meta" }, status: "status", extra: (role) => <RolePermissions role={role} onSaved={() => setVersion((was) => was + 1)} /> }}
    />
  );
}
