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

type WorkingDraft = { id: string; forked: boolean };

const openDraftsNewestFirst = async (who: string): Promise<Draft[]> => {
  const drafts = (await post<{ items: (Draft & { created_at: string })[] }>(who, "agency_list_drafts")).items ?? [];
  return drafts.filter((draft) => draft.status === "open").sort((a, b) => b.created_at.localeCompare(a.created_at));
};

const forkLatest = async (who: string): Promise<WorkingDraft> => {
  const latest = (await publicationsOf(who)).sort((a, b) => b.version - a.version)[0];
  const draft = await post<{ id: string }>(who, "agency_create_draft", { forked_from_type: "publication", forked_from_id: latest.tag });
  return { id: draft.id, forked: true };
};

const openDraftOrFork = async (who: string): Promise<WorkingDraft> => {
  const reusable = (await openDraftsNewestFirst(who))[0];
  return reusable ? { id: reusable.id, forked: false } : forkLatest(who);
};

const letGo = async (who: string, draft: WorkingDraft): Promise<void> => {
  if (draft.forked) await post(who, "agency_archive_draft", { draft_id: draft.id });
};

const moduleRowsOf = async (who: string, draftId: string): Promise<ModuleRow[]> =>
  (await post<{ items: ModuleRow[] }>(who, "agency_list_modules", { draft_id: draftId })).items;

export const modulesOffered = async (who: string = defaultWho): Promise<string[]> => {
  const open = await openDraftsNewestFirst(who);
  if (open.length === 0) {
    const forked = await forkLatest(who);
    const rows = await moduleRowsOf(who, forked.id);
    await letGo(who, forked);
    return rows.map((row) => row.code);
  }
  const codes = new Set<string>();
  for (const draft of open) for (const row of await moduleRowsOf(who, draft.id)) codes.add(row.code);
  return [...codes];
};

const sameOptionalModules = (mounted: string[], wanted: string[]): boolean => {
  const have = mounted.filter((code) => switchable.includes(code));
  const want = wanted.filter((code) => switchable.includes(code));
  return have.length === want.length && want.every((code) => have.includes(code));
};

const publishWanted = async (who: string, draftId: string, wanted: string[]): Promise<boolean> => {
  const rows = await moduleRowsOf(who, draftId);
  const held = rows.map((row) => row.code);
  if (!wanted.filter((code) => switchable.includes(code)).every((code) => held.includes(code))) return false;
  for (const row of rows.filter((entry) => switchable.includes(entry.code) && !entry.locked)) {
    await post(who, "agency_set_module_enabled", { draft_id: draftId, module_id: row.id, enabled: wanted.includes(row.code) });
  }
  try {
    await publishFresh(who, draftId);
    return true;
  } catch (error) {
    if (String(error).includes("no changes detected")) return false;
    throw error;
  }
};

export const mountOnly = async (wanted: string[], who: string = defaultWho): Promise<boolean> => {
  if (sameOptionalModules(await mountedModules(who), wanted)) return false;
  for (const draft of await openDraftsNewestFirst(who)) {
    if (await publishWanted(who, draft.id, wanted)) return true;
  }
  const forked = await forkLatest(who);
  if (await publishWanted(who, forked.id, wanted)) return true;
  throw new Error(`no draft could publish the mounts ${wanted.join(",") || "none"}`);
};

export const mountedModules = async (who: string = defaultWho): Promise<string[]> => {
  const reply = await post<{ modules: { module: string }[] }>(who, "agency_list_mounts");
  return reply.modules.map((entry) => entry.module);
};

export const switchOffActor = async (who: string = defaultWho): Promise<boolean> => {
  const draft = await openDraftOrFork(who);
  const rows = await moduleRowsOf(who, draft.id);
  const actor = rows.find((row) => row.code === "actor") as ModuleRow;
  await post(who, "agency_set_module_enabled", { draft_id: draft.id, module_id: actor.id, enabled: false }).catch(() => undefined);
  const after = await moduleRowsOf(who, draft.id);
  await letGo(who, draft);
  return after.find((row) => row.code === "actor")?.enabled === true;
};
