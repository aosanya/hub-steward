import { McpError, callTool } from "../../wakala/mcp";
import type { ActionRun, PageModule, Query } from "../types";
import { itemsOf, proposeWrite, textOf, trimmedValue } from "./groups";

type UserRecord = { id: string; actorId: string; displayName: string; name: string; created: string; memberCode: string };

export type WaitingToJoin = { id: string; actorId: string; name: string; group: string };

export type SeatRole = { group: string; role: string };

export type UserRow = {
  id: string;
  member_code: string;
  user: string;
  groups: string[];
  roles: SeatRole[];
  access: string;
  joined: string;
};

const userRecord = (raw: Record<string, unknown>): UserRecord => ({
  id: textOf(raw, "id"),
  actorId: textOf(raw, "actor_id"),
  displayName: textOf(raw, "display_name"),
  name: textOf(raw, "name"),
  created: textOf(raw, "created_at"),
  memberCode: textOf(raw, "public_code"),
});

const keyOf = (user: UserRecord) => user.actorId || user.id;

const nameOf = (user: UserRecord) => user.displayName || user.name;

const usersIn = (answer: unknown): UserRecord[] => itemsOf(answer).map(userRecord);

const rfc3339 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

const timeOf = (text: string): number | null => {
  if (!rfc3339.test(text)) return null;
  const time = Date.parse(text);
  return Number.isNaN(time) ? null : time;
};

const allActors = async (hubId: string): Promise<UserRecord[]> => usersIn(await callTool<unknown>(hubId, "actor_list_actors", {}));

const rosterKeys = async (hubId: string, groupId: string): Promise<Set<string>> => {
  const roster = await callTool<unknown>(hubId, "actor_list_actors_for_group", { group_id: groupId });
  return new Set(usersIn(roster).map(keyOf));
};

const groupNamesByUser = async (hubId: string, groups: Record<string, unknown>[]): Promise<Map<string, string[]>> => {
  const rosters = await Promise.all(
    groups.map((group) => callTool<unknown>(hubId, "actor_list_actors_for_group", { group_id: textOf(group, "id") })),
  );
  const namesOf = new Map<string, string[]>();
  groups.forEach((group, index) => {
    for (const member of usersIn(rosters[index])) {
      const key = keyOf(member);
      if (key) namesOf.set(key, [...(namesOf.get(key) ?? []), textOf(group, "name")]);
    }
  });
  return namesOf;
};

type Seats = { held: Map<string, SeatRole[]>; roleNames: string[] };

const noSeats: Seats = { held: new Map(), roleNames: [] };

const seatsByUser = async (hubId: string, groups: Record<string, unknown>[]): Promise<Seats> => {
  const kinds = await callTool<unknown>(hubId, "actor_list_role_kinds", {}).then(itemsOf, () => null);
  if (kinds === null) return noSeats;
  const roleNames = kinds.map((kind) => textOf(kind, "name")).filter(Boolean);
  const holders = await Promise.all(
    kinds.map((kind) => callTool<unknown>(hubId, "actor_list_role_holders", { kind_id: textOf(kind, "id"), active_only: true })),
  ).catch(() => null);
  if (holders === null) return { held: new Map(), roleNames };
  const groupNameOf = new Map(groups.map((group) => [textOf(group, "id"), textOf(group, "name")]));
  const held = new Map<string, SeatRole[]>();
  kinds.forEach((kind, index) => {
    const role = textOf(kind, "name");
    for (const seat of itemsOf(holders[index])) {
      const key = textOf(seat, "actor_id") || textOf(seat, "id");
      if (!key) continue;
      const group = groupNameOf.get(textOf(seat, "group_id")) ?? "";
      const seats = held.get(key) ?? [];
      if (!seats.some((had) => had.group === group && had.role === role)) held.set(key, [...seats, { group, role }]);
    }
  });
  return { held, roleNames };
};

export const filterUserRows = (list: UserRow[], query: Query): UserRow[] => {
  const search = (query.search ?? "").trim().toLowerCase();
  const role = (query.role ?? "").trim().toLowerCase();
  const since = timeOf(query.since ?? "");
  return list
    .filter((row) => !search || row.user.toLowerCase().includes(search))
    .filter((row) => !role || row.roles.some((seat) => seat.role.toLowerCase() === role))
    .filter((row) => {
      if (since === null) return true;
      const joined = timeOf(row.joined);
      return joined !== null && joined >= since;
    });
};

const waitingAmong = async (hubId: string, groups: Record<string, unknown>[], everyone: UserRecord[]): Promise<WaitingToJoin[]> => {
  const requests = await Promise.all(
    groups.map((group) => callTool<unknown>(hubId, "actor_list_join_requests_for_group", { group_id: textOf(group, "id"), pending_only: true })),
  );
  const names = new Map(everyone.map((actor) => [keyOf(actor), nameOf(actor) || actor.memberCode]));
  return groups.flatMap((group, index) =>
    itemsOf(requests[index])
      .filter((request) => textOf(request, "state") === "pending")
      .map((request) => ({
        id: textOf(request, "id"),
        actorId: textOf(request, "actor_id"),
        name: names.get(textOf(request, "actor_id")) || textOf(request, "actor_id"),
        group: textOf(group, "name"),
      })),
  );
};

export type UsersRead = { rows: UserRow[]; roleNames: string[]; waiting: WaitingToJoin[]; waitingFailed: boolean };

const readUsers = async (hubId: string, query: Query, asking: boolean): Promise<UsersRead> => {
  const groups = itemsOf(await callTool<unknown>(hubId, "actor_list_groups", {}));
  const [everyone, inGroup, seats, groupsOf] = await Promise.all([
    allActors(hubId),
    query.group ? rosterKeys(hubId, query.group) : Promise.resolve(null),
    seatsByUser(hubId, groups),
    groupNamesByUser(hubId, groups),
  ]);
  const actors = inGroup ? everyone.filter((actor) => inGroup.has(keyOf(actor))) : everyone;
  const listed = actors.map((actor) => ({
    id: keyOf(actor),
    member_code: actor.memberCode,
    user: nameOf(actor),
    groups: groupsOf.get(keyOf(actor)) ?? [],
    roles: seats.held.get(keyOf(actor)) ?? [],
    access: "member",
    joined: actor.created,
  }));
  const waiting = asking
    ? await waitingAmong(hubId, groups, everyone).then(
        (requests) => ({ requests, failed: false }),
        () => ({ requests: [] as WaitingToJoin[], failed: true }),
      )
    : { requests: [] as WaitingToJoin[], failed: false };
  return { rows: filterUserRows(listed, query), roleNames: seats.roleNames, waiting: waiting.requests, waitingFailed: waiting.failed };
};

const rows = async (hubId: string, query: Query): Promise<UserRow[]> => (await readUsers(hubId, query, false)).rows;

export const usersWithWaiting = (hubId: string, query: Query = {}) => readUsers(hubId, query, true);

const screenNameForCode = async (hubId: string, code: string): Promise<string> => {
  const unknownCode = new Error("no member has that code");
  let found: unknown;
  try {
    found = await callTool<unknown>(hubId, "actor_get_screen_name_by_code", { code });
  } catch (failure) {
    if (failure instanceof McpError && failure.unauthorized) throw failure;
    throw unknownCode;
  }
  const screenName = textOf(found, "display_name").trim();
  if (!screenName) throw unknownCode;
  return screenName;
};

const inviteUser: ActionRun = async (hubId, values) => {
  const groupId = trimmedValue(values, "group_id");
  if (!groupId) throw new Error("group is required");
  const actorId = trimmedValue(values, "actor_id");
  const actorCode = trimmedValue(values, "actor_code");
  if (!actorId && !actorCode) throw new Error("who to invite is required");
  if (actorId && actorCode) throw new Error("give a member code or a person id, not both");
  const typedName = trimmedValue(values, "name");
  const groupName = trimmedValue(values, "group_name") || groupId;
  const invitee: Record<string, string> = actorCode ? { actor_code: actorCode } : { actor_id: actorId };
  const who = actorCode ? await screenNameForCode(hubId, actorCode) : typedName || actorId;
  return proposeWrite(hubId, "actor_invite_to_group", "Invite " + who + " to " + groupName, { ...invitee, group_id: groupId });
};

export const usersPage: PageModule = {
  spec: {
    id: "users",
    title: "Users",
    primary: "Invite a user",
    tools: [
      "actor_list_actors",
      "actor_list_groups",
      "actor_list_actors_for_group",
      "actor_list_join_requests_for_group",
      "actor_list_role_kinds",
      "actor_list_role_holders",
      "actor_invite_to_group",
      "actor_get_actor",
      "actor_list_groups_for_actor",
      "taskmanager_task_list",
      "assetmanager_hold_list",
    ],
    columns: [
      { key: "user", label: "User" },
      { key: "role", label: "Role" },
      { key: "access", label: "Access" },
      { key: "joined", label: "Joined" },
    ],
  },
  rows,
  actions: { users: inviteUser },
};
