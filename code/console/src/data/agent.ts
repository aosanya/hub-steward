import type { PageSpec } from "../types";
import { callTool } from "../wakala/mcp";
import { limitKeys, limitsWithChanges } from "./modelLimits";

export type ModelOption = { id: string; label: string; provider?: string; baseUrl?: string; modelName?: string };

export type AgentRow = {
  id?: string;
  name: string;
  account_id?: string | null;
  model?: string;
  options?: ModelOption[];
  primary?: string;
  state?: string;
};
export type AgentRows = { rows?: AgentRow[] };

export type StoppedReply = { stopped?: string; limit?: string; set_on?: string; posted?: string };

export type LimitRow = {
  key: string;
  label: string;
  role_limit?: number | null;
  ceiling?: number | string | null;
  in_force?: number | string | null;
  used?: number | string | null;
  source?: string;
};
export type LimitRows = { rows?: LimitRow[] };
export type LimitSettings = Record<string, number | null | undefined>;

export type InstructionPart = { source: string; text: string };
export type InstructionsReply = {
  parts?: InstructionPart[];
  fine_tuning?: string;
  use_agency_instructions?: boolean;
};
export type InstructionsInput = { fine_tuning: string; use_agency_instructions: boolean };

export type Revision = {
  id: string | number;
  saved_at?: string;
  saved_by?: string;
  created_at?: string;
  at?: string;
  created_by?: string;
  by?: string;
};
export type RevisionRows = { rows?: Revision[] };

type Loose = Record<string, any>;

type ResolvedLimit = { limit?: string; field?: string; max?: number; used?: number; source?: string };

type Resolved = { account?: Loose | null; limits?: ResolvedLimit[] | null; parts?: InstructionPart[] | null };

const noModelWords = "No model: this role cannot speak";
const saveChangesWords = "Save changes";
const needsRoleWords = "choose an agent to edit";
const needsModelWords = "choose a model";
const negativeLimitWords = "a limit cannot be below zero";
const notUnderstoodWords = "that was not understood";
const needsRevisionWords = "a revision is needed";
const reachedPhrase = "limit is reached";

export const agentEditSpec: PageSpec = {
  id: "agent-edit",
  title: "Agent",
  primary: saveChangesWords,
  tools: ["ai_get_role", "ai_list_accounts", "ai_map_role"],
  columns: [
    { key: "name", label: "Agent" },
    { key: "model", label: "Model" },
  ],
};

const requireRole = (role: string) => {
  if (!role) throw new Error(needsRoleWords);
};

const readRole = (hubId: string, role: string) => callTool<Loose>(hubId, "ai_get_role", { roleID: role });

const resolveRole = (hubId: string, role: string) => callTool<Resolved>(hubId, "ai_resolve_role", { roleID: role });

const text = (value: unknown) => (typeof value === "string" ? value : "");

const itemsOf = (raw: unknown): Loose[] => {
  if (Array.isArray(raw)) return raw;
  const items = (raw as { items?: unknown } | null)?.items;
  if (Array.isArray(items)) return items;
  throw new Error("the answer was not a list");
};

const namesById = (items: Loose[], field: string) =>
  new Map(items.filter((item) => text(item.id) !== "").map((item): [string, string] => [item.id, text(item[field])]));

const copyHeld = (role: Loose, keys: readonly string[]) =>
  Object.fromEntries(keys.filter((key) => key in role).map((key) => [key, role[key]]));

const limitLabel = (field: string) => {
  const words = field.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
};

const formatCount = (value: number) => String(Math.trunc(value));

export async function agentRows(hubId: string, role: string): Promise<AgentRows> {
  requireRole(role);
  const held = await readRole(hubId, role);
  const accounts = itemsOf(await callTool(hubId, "ai_list_accounts"));
  const accountId = text(held.account_id);
  const model = namesById(accounts, "model_name").get(accountId) ?? "";
  const row: AgentRow = {
    id: role,
    name: held.name,
    account_id: accountId,
    model,
    options: accounts.map((account) => ({
      id: account.id,
      label: account.model_name,
      provider: text(account.provider),
      baseUrl: text(account.base_url),
      modelName: text(account.model_name),
    })),
    primary: saveChangesWords,
  };
  if (model === "") {
    row.model = noModelWords;
    row.state = noModelWords;
  }
  return { rows: [row] };
}

export async function saveAgentModel(hubId: string, role: string, accountId: string): Promise<void> {
  requireRole(role);
  if (!accountId) throw new Error(needsModelWords);
  const held = await readRole(hubId, role);
  await callTool(hubId, "ai_map_role", { roleID: role, account_id: accountId, agency_role_id: text(held.agency_role_id) });
}

export async function agentLimits(hubId: string, role: string): Promise<LimitRows> {
  requireRole(role);
  const held = await readRole(hubId, role);
  const resolved = await resolveRole(hubId, role);
  const rows = limitKeys.map((key): LimitRow => {
    const row: LimitRow = {
      key,
      label: limitLabel(key),
      role_limit: held[key] ?? null,
      ceiling: resolved.account ? (resolved.account[key] ?? null) : 0,
      in_force: 0,
      used: 0,
      source: "none",
    };
    for (const limit of resolved.limits ?? []) {
      if (limit.field !== key) continue;
      row.in_force = limit.max ?? 0;
      row.used = limit.used ?? 0;
      row.source = limit.source ?? "";
    }
    return row;
  });
  return { rows };
}

export async function saveAgentLimits(hubId: string, role: string, limits: LimitSettings): Promise<void> {
  if (Object.values(limits).some((value) => value != null && !Number.isInteger(value))) {
    throw new Error(notUnderstoodWords);
  }
  requireRole(role);
  if (limitKeys.some((key) => (limits[key] ?? 0) < 0)) throw new Error(negativeLimitWords);
  const held = await readRole(hubId, role);
  const changes = Object.fromEntries(limitKeys.map((key) => [key, limits[key] ?? null]));
  await callTool(hubId, "ai_update_role", {
    roleID: role,
    ...copyHeld(held, ["name", "description", "fine_tuning", "use_agency_instructions", "status"]),
    ...limitsWithChanges(held, changes),
  });
}

export async function agentInstructions(hubId: string, role: string): Promise<InstructionsReply> {
  requireRole(role);
  const held = await readRole(hubId, role);
  const resolved = await resolveRole(hubId, role);
  return {
    parts: resolved.parts ?? [],
    fine_tuning: text(held.fine_tuning),
    use_agency_instructions: held.use_agency_instructions === true,
  };
}

export async function saveAgentInstructions(hubId: string, role: string, input: InstructionsInput): Promise<void> {
  requireRole(role);
  const held = await readRole(hubId, role);
  await callTool(hubId, "ai_update_role", {
    roleID: role,
    ...copyHeld(held, ["name", "description", "status"]),
    ...limitsWithChanges(held, {}),
    fine_tuning: input.fine_tuning,
    use_agency_instructions: input.use_agency_instructions,
  });
}

export async function agentRevisions(hubId: string, role: string): Promise<RevisionRows> {
  requireRole(role);
  const raw = await callTool<unknown>(hubId, "ai_list_role_revisions", { roleID: role });
  const items = Array.isArray(raw) ? raw : (raw as { items?: Revision[] } | null)?.items;
  return { rows: items ?? [] };
}

export async function restoreAgentRevision(hubId: string, role: string, revisionId: string): Promise<void> {
  requireRole(role);
  if (!revisionId) throw new Error(needsRevisionWords);
  await callTool(hubId, "ai_restore_role_revision", { roleID: role, revisionID: revisionId });
}

const limitThreadLabel = "AI limit";

type Posted = { body: string; at: string };

const listItems = (raw: unknown): Loose[] => {
  if (Array.isArray(raw)) return raw;
  const items = (raw as { items?: unknown } | null)?.items;
  return Array.isArray(items) ? items : [];
};

const limitMessagesIn = async (hubId: string, room: string, thread: string): Promise<Posted[]> => {
  const listed = await callTool<unknown>(hubId, "comm_chat_message_list", { structure_id: room, thread_id: thread });
  return listItems(listed)
    .map((item): Posted => ({ body: text(item.body), at: text(item.created_at) }))
    .filter((posted) => posted.body.includes(reachedPhrase));
};

const latestPosted = (all: Posted[]) => all.map((posted, index) => ({ posted, index })).sort(
  (a, b) => a.posted.at.localeCompare(b.posted.at) || a.index - b.index,
).at(-1)?.posted.body ?? "";

const postedLimitMessage = async (hubId: string, room: string, thread: string) =>
  latestPosted(await limitMessagesIn(hubId, room, thread));

const postedInAnyRoom = async (hubId: string): Promise<string> => {
  const rooms = listItems(await callTool<unknown>(hubId, "actor_list_groups")).map((group) => text(group.id)).filter(Boolean);
  const found: Posted[] = [];
  for (const room of rooms) {
    const threads = listItems(await callTool<unknown>(hubId, "comm_chat_thread_list", { structure_id: room }));
    for (const thread of threads) {
      if (thread.label !== limitThreadLabel || text(thread.id) === "") continue;
      found.push(...(await limitMessagesIn(hubId, room, text(thread.id))));
    }
  }
  return latestPosted(found);
};

export async function agentStopped(hubId: string, role: string, room = "", thread = ""): Promise<StoppedReply> {
  requireRole(role);
  const held = await readRole(hubId, role);
  const resolved = await resolveRole(hubId, role);
  const name = text(held.name);
  const out = { stopped: name + " has not stopped on a limit.", limit: "", set_on: "", posted: "" };
  const reached = (resolved.limits ?? []).find((limit) => (limit.max ?? 0) > 0 && (limit.used ?? 0) >= (limit.max ?? 0));
  if (reached) {
    const max = reached.max ?? 0;
    const label = reached.field ? limitLabel(reached.field) : (reached.limit ?? "");
    const byRole = reached.source === "role";
    if (byRole) out.set_on = text(held.updated_at);
    out.stopped = `${name} stopped because ${byRole ? "the role's" : "the model's"} ${label} limit is reached.`;
    out.limit = `${label}: ${formatCount(max)} (${formatCount(reached.used ?? 0)} used)`;
  }
  if (!out.limit) return out;
  if (room && thread) out.posted = await postedLimitMessage(hubId, room, thread);
  else out.posted = await postedInAnyRoom(hubId).catch(() => "");
  return out;
}
