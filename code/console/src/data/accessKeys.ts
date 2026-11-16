import { runtimeConfig } from "../wakala/config";
import { reasonOf, rest } from "../wakala/rest";
import { text, type Loose } from "./modelLimits";

export type AccessKey = { id: string; name: string; madeOn: string };

export type MadeKey = { token: string; cloneLine: string };

const keysPath = "/auth/api-keys";

const keyOf = (raw: Loose): AccessKey => ({ id: text(raw.id), name: text(raw.name), madeOn: text(raw.created_at) });

const live = (raw: Loose): boolean => raw.revoked_at === undefined || raw.revoked_at === null || raw.revoked_at === "";

export async function listAccessKeys(): Promise<AccessKey[]> {
  const reply = await rest<unknown>("GET", keysPath);
  if (!reply.ok) throw new Error(reasonOf(reply, ""));
  return (Array.isArray(reply.data) ? (reply.data as Loose[]) : []).filter(live).map(keyOf);
}

const cloneLineFor = async (hubId: string): Promise<string> => {
  const { wakala } = await runtimeConfig();
  return `git clone ${wakala || window.location.origin}/git/${hubId}/<repository>.git`;
};

export async function makeAccessKey(hubId: string, name: string): Promise<MadeKey> {
  const reply = await rest<Loose>("POST", keysPath, { name });
  if (!reply.ok) throw new Error(reasonOf(reply, ""));
  return { token: text(reply.data.token), cloneLine: await cloneLineFor(hubId) };
}

export async function revokeAccessKey(id: string): Promise<void> {
  const reply = await rest("DELETE", `${keysPath}/${encodeURIComponent(id)}`);
  if (!reply.ok) throw new Error(reasonOf(reply, ""));
}
