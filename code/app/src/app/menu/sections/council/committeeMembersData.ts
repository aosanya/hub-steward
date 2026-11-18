import { callTool } from "../../../../shared/wakala/mcp";
import { listOf, text, type Item } from "./councilData";

export type Member = { seat: string; actor: string; name: string; role: string };

export type Person = { id: string; name: string };

export type Roster = { members: Member[]; people: Person[]; memberKind: string };

const memberKindName = "member";

const isActive = (seat: Item) => seat.active !== false && text(seat, "ended_at") === "";

const chairsFirst = (leading: Set<string>) => (one: Item, other: Item) => Number(leading.has(text(other, "kind_id"))) - Number(leading.has(text(one, "kind_id")));

export const loadRoster = async (groupId: string): Promise<Roster> => {
  const [seats, kinds, actors] = await Promise.all([
    listOf("actor_list_role_assignments_for_group", { group_id: groupId, active_only: true }),
    listOf("actor_list_role_kinds"),
    listOf("actor_list_actors"),
  ]);
  const names = new Map(actors.map((actor) => [text(actor, "id"), text(actor, "display_name")]));
  const kindNames = new Map(kinds.map((kind) => [text(kind, "id"), text(kind, "name")]));
  const leading = new Set(kinds.filter((kind) => kind.leads_group === true).map((kind) => text(kind, "id")));
  const members = seats
    .filter(isActive)
    .sort(chairsFirst(leading))
    .map((seat) => ({ seat: text(seat, "id"), actor: text(seat, "actor_id"), name: names.get(text(seat, "actor_id")) ?? text(seat, "actor_id"), role: kindNames.get(text(seat, "kind_id")) ?? "" }));
  const memberKind = kinds.find((kind) => text(kind, "name").toLowerCase() === memberKindName && text(kind, "retired_at") === "");
  return { members, people: actors.map((actor) => ({ id: text(actor, "id"), name: text(actor, "display_name") })).filter((person) => person.name !== ""), memberKind: text(memberKind, "id") };
};

export const addMember = async (groupId: string, actorId: string, kindId: string) => {
  await callTool("", "actor_assign_group", { actor_id: actorId, group_id: groupId });
  await callTool("", "actor_grant_role", { actor_id: actorId, group_id: groupId, kind_id: kindId });
};

export const removeMember = (seatId: string) => callTool("", "actor_revoke_role", { assignment_id: seatId });
