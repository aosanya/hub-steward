import { currencyUnit } from "../../../../features/forms/QuestionInput";
import { spacedAmount } from "../../../../features/steps/spacedAmount";
import { loadRoleKinds } from "../../roleKinds";
import { listOf, peopleWords, text, type Item } from "./staffData";

const liveDraftOf = async () => {
  const production = (await listOf("agency_list_publications")).filter((publication) => publication.channel === "production");
  const newest = production.sort((a, b) => Number(b.version ?? 0) - Number(a.version ?? 0))[0];
  return text(newest, "draft_id");
};

export const amountWords = (limit: number) => `${spacedAmount(limit)} ${currencyUnit}`;

const isLimit = (limit: unknown): limit is number => typeof limit === "number" && Number.isFinite(limit);

const withoutLimitWords = (without: number, all: number) => {
  if (without === all) return "No limit set.";
  return without === 1 ? "One holder has no limit set." : `${without} holders have no limit set.`;
};

const limitWords = (standing: Item[]) => {
  if (standing.length === 0) return "";
  const limits = standing.map((seat) => seat.approval_limit).filter(isLimit);
  if (limits.length < standing.length) return withoutLimitWords(standing.length - limits.length, standing.length);
  return amountWords(Math.max(...limits));
};

const holdersOf = async (kind: Item) => {
  const seats = await listOf("actor_list_role_holders", { kind_id: text(kind, "id") });
  const standing = seats.filter((seat) => seat.active !== false && text(seat, "ended_at") === "");
  const limitOf = (seat: Item) => (typeof seat.approval_limit === "number" && Number.isFinite(seat.approval_limit) ? seat.approval_limit : null);
  const editable = standing.map((seat) => ({ id: text(seat, "id"), actorId: text(seat, "actor_id"), limit: limitOf(seat) }));
  return { kindId: text(kind, "id"), count: new Set(standing.map((seat) => text(seat, "actor_id"))).size, limit: limitWords(standing), seats: editable };
};

export const loadRoles = async () => {
  const draft = await liveDraftOf();
  const [roles, kinds] = await Promise.all([listOf("agency_list_roles", { draft_id: draft }), loadRoleKinds()]);
  const holders = new Map(await Promise.all(kinds.map(async (kind) => [kind.definitionRoleId, await holdersOf(kind.item)] as const)));
  return roles.map((role) => ({
    id: text(role, "id"),
    name: text(role, "name"),
    meta: peopleWords(holders.get(text(role, "code"))?.count ?? 0),
    limit: holders.get(text(role, "code"))?.limit ?? "",
    seats: holders.get(text(role, "code"))?.seats ?? [],
    kindId: holders.get(text(role, "code"))?.kindId ?? "",
    draft,
    permissions: Array.isArray(role.permissions) ? role.permissions : [],
  }));
};

export const loadRole = async (id: string) => (await loadRoles()).find((role) => role.id === id) ?? { id, name: "", meta: "", limit: "", seats: [], kindId: "", draft: "", permissions: [] };
