import { api, type ApiResult } from "../api";
import type { Hub } from "../types";
import { consentPermission } from "../data/seat";
import { runtimeConfig } from "./config";
import { callTool, resetMcp } from "./mcp";

export type Credentials = { email: string; password: string };

export type Failure = { error?: unknown };

export type Imported = { instance?: { id?: string; name?: string } };

const ownerRole = "owner";

const rest = async <T = any>(method: string, path: string, body?: unknown): Promise<ApiResult<T>> => {
  const { wakala } = await runtimeConfig();
  return api<T>(method, wakala + path, body, { credentials: "include" });
};

export const reasonOf = (reply: ApiResult<unknown> | null, fallback: string): string => {
  const data = reply?.data;
  const reason = typeof data === "object" && data !== null ? (data as Failure).error : undefined;
  return typeof reason === "string" && reason.trim() !== "" ? reason : fallback;
};

export const signIn = async (credentials: Credentials) => {
  const reply = await rest("POST", "/auth/signin", credentials);
  if (reply.ok) resetMcp();
  return reply;
};

export const signOut = async () => {
  try {
    return await rest("POST", "/auth/signout");
  } finally {
    resetMcp();
  }
};

export const checkSession = () => rest("GET", "/auth/session");

const hubRows = (memberships: unknown): any[] =>
  (Array.isArray(memberships) ? memberships : []).filter(
    (m) => typeof m === "object" && m !== null && typeof m.id === "string",
  );

const hubOf = (row: any, role: string): Hub => ({
  id: row.id,
  name: typeof row.name === "string" ? row.name : row.id,
  role,
  ...(typeof row.kind === "string" && row.kind !== "" ? { kind: row.kind } : {}),
});

const publisherHub = async (row: any): Promise<Hub | null> => {
  try {
    const reply = await rest("GET", `/instances/${row.id}/my-roles`);
    const data = reply.ok ? reply.data : null;
    const codes: string[] = Array.isArray(data?.permissions)
      ? data.permissions.filter((code: unknown) => typeof code === "string")
      : [];
    if (!codes.includes(consentPermission)) return null;
    const membership = typeof data?.membership === "string" && data.membership !== "" ? data.membership : row.role;
    return { ...hubOf(row, typeof membership === "string" ? membership : ""), permissions: codes };
  } catch {
    return null;
  }
};

const managersRoom = "managers' room";

const managerRoomOf = async (hubId: string): Promise<string | undefined> => {
  try {
    const answer = await callTool<any>(hubId, "actor_list_groups");
    const groups: any[] = Array.isArray(answer?.items) ? answer.items : Array.isArray(answer) ? answer : [];
    const found = groups.find((g) => typeof g?.name === "string" && g.name.trim().toLowerCase() === managersRoom);
    return typeof found?.id === "string" ? found.id : undefined;
  } catch {
    return undefined;
  }
};

const ownedHub = async (row: any): Promise<Hub> => {
  const hub = hubOf(row, ownerRole);
  const room = await managerRoomOf(hub.id);
  return room ? { ...hub, manager_room_id: room } : hub;
};

export const listHubs = async (): Promise<Hub[] | null> => {
  const reply = await rest("GET", "/instances");
  if (!reply.ok) return null;
  const hubs = await Promise.all(
    hubRows(reply.data).map((row) => (row.role === ownerRole ? ownedHub(row) : publisherHub(row))),
  );
  return hubs.filter((hub): hub is Hub => hub !== null);
};

export const restoreHubs = async (): Promise<Hub[] | null> => {
  const session = await checkSession();
  return session.ok ? listHubs() : null;
};

export const importHub = (name: string, template: Record<string, unknown>) =>
  rest<Imported>("POST", "/instances/import", { ...template, name });

export const listServices = () => rest("GET", "/services");

export const serviceNames = (services: unknown): string[] =>
  (Array.isArray(services) ? services : []).flatMap((s) => (typeof s?.service === "string" ? [s.service] : []));
