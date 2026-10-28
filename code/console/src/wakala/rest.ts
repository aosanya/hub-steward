import { api, type ApiResult } from "../api";
import type { Hub } from "../types";
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

const ownedHubs = (memberships: unknown): Hub[] =>
  (Array.isArray(memberships) ? memberships : [])
    .filter((m) => typeof m === "object" && m !== null && m.role === ownerRole && typeof m.id === "string")
    .map((m) => ({
      id: m.id,
      name: typeof m.name === "string" ? m.name : m.id,
      role: ownerRole,
      ...(typeof m.kind === "string" && m.kind !== "" ? { kind: m.kind } : {}),
    }));

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

export const listHubs = async (): Promise<Hub[] | null> => {
  const reply = await rest("GET", "/instances");
  if (!reply.ok) return null;
  return Promise.all(
    ownedHubs(reply.data).map(async (hub) => {
      const room = await managerRoomOf(hub.id);
      return room ? { ...hub, manager_room_id: room } : hub;
    }),
  );
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
