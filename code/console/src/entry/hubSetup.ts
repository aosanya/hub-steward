import { agentPermission } from "../data/pages/agents";
import { itemsOf, textOf } from "../data/pages/groups";
import type { Hub } from "../types";
import { runtimeConfig } from "../wakala/config";
import { McpError, callTool } from "../wakala/mcp";
import { importHub, listServices, serviceNames } from "../wakala/rest";

export const serviceName = "hub-steward";
export const agentRoleName = "Hub Steward";

export const roomNames = ["Managers' room", "Farmers' room", "Suppliers' room"];

const roomJoinMode = "open";
const importedDraftPrefix = "Imported from ";

type Reason = { key: string } | { text: string };

export class SetupFailure extends Error {
  constructor(
    readonly reason: Reason,
    readonly unauthorized = false,
    readonly stage = 0,
  ) {
    super("the hub could not be set up");
  }
}

export const setupStages = 3;

const atStage = async <T>(stage: number, work: () => Promise<T>): Promise<T> => {
  try {
    return await work();
  } catch (error) {
    if (error instanceof SetupFailure) throw new SetupFailure(error.reason, error.unauthorized, stage);
    throw new SetupFailure({ key: "submitFailed" }, error instanceof McpError && error.unauthorized, stage);
  }
};

const refused = (status: number) => status === 401 || status === 403;

const guarded = async <T>(key: string, work: () => Promise<T>): Promise<T> => {
  try {
    return await work();
  } catch (error) {
    if (error instanceof SetupFailure) throw error;
    throw new SetupFailure({ key }, error instanceof McpError && error.unauthorized);
  }
};

const failureOf = (reply: { status: number; data: unknown }): SetupFailure => {
  const data = reply.data;
  const reason = typeof data === "object" && data !== null ? (data as { error?: unknown }).error : undefined;
  const reasonText = typeof reason === "string" ? reason.trim() : "";
  return new SetupFailure(reasonText === "" ? { key: "submitFailed" } : { text: reasonText }, refused(reply.status));
};

const requireService = async () => {
  const reply = await listServices();
  if (!reply.ok) throw failureOf(reply);
  if (!serviceNames(reply.data).includes(serviceName)) throw new SetupFailure({ key: "createNoService" });
};

const loadTemplate = async (template: string): Promise<Record<string, unknown>> => {
  const failure = new SetupFailure({ key: "createNoTemplate" });
  const reply = await fetch(`/templates/${encodeURIComponent(template)}.json`).catch(() => null);
  if (!reply?.ok) throw failure;
  const document = await reply.json().catch(() => null);
  if (typeof document !== "object" || document === null || Array.isArray(document)) throw failure;
  return document;
};

export type HubSource = string | Record<string, unknown>;

const importSource = async (name: string, source: HubSource): Promise<Hub> => {
  const document = typeof source === "string" ? await loadTemplate(source) : source;
  const reply = await importHub(name, document);
  if (!reply.ok) throw failureOf(reply);
  const id = reply.data.instance?.id;
  if (typeof id !== "string" || id === "") throw new SetupFailure({ key: "submitFailed" });
  return { id, name: reply.data.instance?.name || name, role: "owner" };
};

const findAgentRoleId = (hubId: string) =>
  guarded("createNotLinked", async () => {
    const drafts = itemsOf(await callTool(hubId, "agency_list_drafts"));
    const draft = drafts.find((d) => textOf(d, "description").startsWith(importedDraftPrefix)) ?? drafts[0];
    const draftId = textOf(draft, "id");
    if (draftId === "") throw new SetupFailure({ key: "createNoRole" });
    const roles = itemsOf(await callTool(hubId, "agency_list_roles", { draft_id: draftId }));
    const named = roles.filter((r) => textOf(r, "id") !== "");
    const usesAI = named.filter((r) => Array.isArray(r.permissions) && r.permissions.includes(agentPermission));
    const role = usesAI.find((r) => textOf(r, "name") === agentRoleName) ?? usesAI[0] ?? named.find((r) => textOf(r, "name") === agentRoleName);
    if (!role) throw new SetupFailure({ key: "createNoRole" });
    return textOf(role, "id");
  });

const grantService = (hubId: string, agencyRoleId: string) =>
  guarded("createNotLinked", () =>
    callTool(hubId, "agency_grant_service", { service: serviceName, agency_role_id: agencyRoleId }),
  );

const createRoom = async (hubId: string, name: string) => {
  const id = textOf(await callTool(hubId, "actor_create_group", { name }), "id");
  if (id === "") throw new McpError("actor_create_group: no room id");
  await callTool(hubId, "actor_set_group_join_mode", { group_id: id, join_mode: roomJoinMode });
};

const createRooms = (hubId: string) =>
  guarded("createNoRooms", async () => {
    for (const name of roomNames) await createRoom(hubId, name);
  });

export const configuredTemplate = async () => (await runtimeConfig()).template;

export async function setUpHub(name: string, source: HubSource, done: (stages: number, hub: Hub) => void = () => {}): Promise<Hub> {
  const hub = await atStage(0, async () => {
    await requireService();
    return importSource(name, source);
  });
  done(1, hub);
  await atStage(1, async () => grantService(hub.id, await findAgentRoleId(hub.id)));
  done(2, hub);
  await atStage(2, () => createRooms(hub.id));
  done(3, hub);
  return hub;
}
