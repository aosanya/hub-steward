import { itemsOf } from "../../features/backlogs";
import { callTool } from "../../shared/wakala/mcp";

type Item = Record<string, unknown>;

export type RoleKind = { id: string; name: string; retired: boolean; leadsGroup: boolean; definitionRoleId: string; item: Item };

export type RoleChoice = { value: string; label: string };

export const goneRoleWords = "a role that no longer exists";

const textOf = (value: unknown) => (typeof value === "string" ? value : "");

export const loadRoleKinds = async (): Promise<RoleKind[]> =>
  (itemsOf(await callTool("", "actor_list_role_kinds")) as Item[]).map((item) => ({
    id: textOf(item.id),
    name: textOf(item.name),
    retired: Boolean(item.retired_at),
    leadsGroup: item.leads_group === true,
    definitionRoleId: textOf(item.definition_role_id),
    item,
  }));

export const roleNamesOf = (kinds: RoleKind[]) => new Map(kinds.map((kind) => [kind.id, kind.name]));

export const roleKindName = (kinds: RoleKind[], id: string) => kinds.find((kind) => kind.id === id)?.name || goneRoleWords;

export const openRoleChoices = (kinds: RoleKind[]): RoleChoice[] =>
  kinds.filter((kind) => !kind.retired && kind.name !== "").map((kind) => ({ value: kind.id, label: kind.name }));
