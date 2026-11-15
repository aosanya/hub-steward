import { existsSync, readFileSync } from "node:fs";
import { agencyNamed, apiUrl, defaultWho, person, post, qaFolder, sessionCookie } from "./live";

type Held = { id: string; name: string };
type ModuleRow = { id: string; code: string; enabled: boolean; locked: boolean };
type Publication = { version: number; tag: string };
type Draft = { id: string; status: string };

const switchable = ["digitaltwin", "assetmanager", "forms", "accounting", "voting"];

const jarCookie = (who: string): string => {
  const jar = `${qaFolder}/${who}.cookies`;
  if (!existsSync(jar)) return "";
  const line = readFileSync(jar, "utf8")
    .split("\n")
    .find((row) => row.includes(`\t${sessionCookie}\t`));
  return line ? line.split("\t")[6].trim() : "";
};

const heldAgencies = async (cookie: string): Promise<Held[] | null> => {
  if (!cookie) return null;
  const reply = await fetch(`${apiUrl}/me`, { headers: { Cookie: `${sessionCookie}=${cookie}` } });
  return reply.ok ? ((await reply.json()) as { agencies: Held[] }).agencies : null;
};

const rawCall = async (cookie: string, tool: string, args: Record<string, unknown>) => {
  const headers = {
    Cookie: `${sessionCookie}=${cookie}`,
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  };
  const opened = await fetch(`${apiUrl}/mcp`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "throwaway-agency", version: "1" } },
    }),
  });
  const session = opened.headers.get("Mcp-Session-Id") ?? "";
  const sessionHeaders = { ...headers, "Mcp-Session-Id": session };
  await fetch(`${apiUrl}/mcp`, { method: "POST", headers: sessionHeaders, body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) });
  const reply = await fetch(`${apiUrl}/mcp`, {
    method: "POST",
    headers: sessionHeaders,
    body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: tool, arguments: args } }),
  });
  const text = (await reply.text()).trim();
  const line = text.startsWith("{") ? text : (text.split("\n").find((row) => row.startsWith("data:")) ?? "").slice(5);
  const message = JSON.parse(line);
  if (message.error || message.result?.isError) throw new Error(`${tool}: ${message.error?.message ?? message.result.content?.[0]?.text}`);
  return message.result.structuredContent;
};

const createIfMissing = async (who: string, name: string): Promise<void> => {
  let cookie = jarCookie(who);
  let agencies = await heldAgencies(cookie);
  if (!agencies) {
    await person(who);
    cookie = jarCookie(who);
    agencies = await heldAgencies(cookie);
  }
  if (agencies?.some((agency) => agency.name === name)) return;
  await rawCall(cookie, "agency_create_instance", { name });
};

const publicationsOf = async (who: string): Promise<Publication[]> =>
  (await post<{ items: Publication[] }>(who, "agency_list_publications")).items ?? [];

const openDraft = async (who: string): Promise<Draft> => {
  const drafts = (await post<{ items: Draft[] }>(who, "agency_list_drafts")).items ?? [];
  const open = drafts.find((draft) => draft.status === "open");
  if (!open) throw new Error("the throwaway agency has no open draft to start from");
  return open;
};

const publishFresh = async (who: string, draftId: string): Promise<void> => {
  await post(who, "agency_publish_agency", { draft_id: draftId, tag: `m${Date.now()}` });
};

const bootstrap = async (who: string): Promise<void> => {
  const draft = await openDraft(who);
  const goal = await post<{ id: string }>(who, "agency_create_goal", { draft_id: draft.id, title: "Test the Home menu" });
  await post(who, "agency_create_objective", { draft_id: draft.id, goal_id: goal.id, title: "Show the right rows" });
  await publishFresh(who, draft.id);
};

export const prepareThrowawayAgency = async (name: string, who: string = defaultWho): Promise<void> => {
  await createIfMissing(who, name);
  agencyNamed(name);
  if ((await publicationsOf(who)).length === 0) await bootstrap(who);
};

export const modulesOffered = async (who: string = defaultWho): Promise<string[]> => {
  const draft = await openDraftOrFork(who);
  const rows = (await post<{ items: ModuleRow[] }>(who, "agency_list_modules", { draft_id: draft })).items;
  await post(who, "agency_archive_draft", { draft_id: draft });
  return rows.map((row) => row.code);
};

const openDraftOrFork = async (who: string): Promise<string> => {
  const latest = (await publicationsOf(who)).sort((a, b) => b.version - a.version)[0];
  const draft = await post<{ id: string }>(who, "agency_create_draft", { forked_from_type: "publication", forked_from_id: latest.tag });
  return draft.id;
};

export const mountOnly = async (wanted: string[], who: string = defaultWho): Promise<boolean> => {
  const draftId = await openDraftOrFork(who);
  const rows = (await post<{ items: ModuleRow[] }>(who, "agency_list_modules", { draft_id: draftId })).items;
  const changes = rows.filter((row) => switchable.includes(row.code) && !row.locked && row.enabled !== wanted.includes(row.code));
  if (changes.length === 0) {
    await post(who, "agency_archive_draft", { draft_id: draftId });
    return false;
  }
  for (const row of changes) {
    await post(who, "agency_set_module_enabled", { draft_id: draftId, module_id: row.id, enabled: wanted.includes(row.code) });
  }
  await publishFresh(who, draftId);
  return true;
};

export const mountedModules = async (who: string = defaultWho): Promise<string[]> => {
  const reply = await post<{ modules: { module: string }[] }>(who, "agency_list_mounts");
  return reply.modules.map((entry) => entry.module);
};

export const switchOffActor = async (who: string = defaultWho): Promise<boolean> => {
  const draftId = await openDraftOrFork(who);
  const rows = (await post<{ items: ModuleRow[] }>(who, "agency_list_modules", { draft_id: draftId })).items;
  const actor = rows.find((row) => row.code === "actor") as ModuleRow;
  await post(who, "agency_set_module_enabled", { draft_id: draftId, module_id: actor.id, enabled: false }).catch(() => undefined);
  const after = (await post<{ items: ModuleRow[] }>(who, "agency_list_modules", { draft_id: draftId })).items;
  await post(who, "agency_archive_draft", { draft_id: draftId });
  return after.find((row) => row.code === "actor")?.enabled === true;
};
