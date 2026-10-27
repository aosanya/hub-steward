import { hasKey, providerOfAccount } from "../../pages/models/accountMap";
import type { PageRow } from "../../types";
import { callTool } from "../../wakala/mcp";
import { listAccounts, type Account } from "../accounts";
import { draftScope } from "../draft";
import type { PageModule } from "../types";

export type Item = Record<string, unknown>;

export type HubModel = { keySet: boolean; provider: string };

const defaultProvider = "huggingface";
const agentStateRunning = "Running";
const agentStateSkipped = "Skipped";
const agentStateStopped = "Stopped";
const roleDisabled = "disabled";
const agentStateNoModel = "No model";
const agenticKinds = ["ai", "agentic"];
export const agentPermission = "ai.use";
const agentModelUnset = "Choose a model";
const agentCannotSpeak = "Cannot speak";
const agentWorksForNone = "Not assigned";
const agentSkippedTarget = "models";
const agentEditTarget = "agent-edit";

const isObject = (value: unknown): value is Item => typeof value === "object" && value !== null && !Array.isArray(value);

const objectsOf = (list: unknown[]): Item[] =>
  list.map((element) => {
    if (element === null) return {};
    if (!isObject(element)) throw new Error("the list held something that is not an object");
    return element;
  });

export const text = (value: unknown): string => (typeof value === "string" ? value : "");

export const idOf = (item: Item) => item.id as string | undefined;

export const asObject = (raw: unknown, tool: string): Item => {
  if (raw === null || raw === undefined) return {};
  if (!isObject(raw)) throw new Error(`${tool}: the answer was not an object`);
  return raw;
};

export const toolMissing = (failure: unknown): boolean => failure instanceof Error && /unknown tool/.test(failure.message);

export const roleItems = (raw: unknown): Item[] => {
  const wrapped = isObject(raw) ? raw.items : undefined;
  if (Array.isArray(wrapped)) return objectsOf(wrapped);
  if (Array.isArray(raw)) return objectsOf(raw);
  throw new Error("the answer was not a list");
};

const defaultAccountOf = (accounts: Account[]): Account | undefined =>
  accounts.find((account) => account.status === "enabled" && account.keySet) ?? accounts[0];

export const hubModel = async (hubId: string): Promise<HubModel> => {
  try {
    const accounts = await listAccounts(hubId);
    const standing = defaultAccountOf(accounts);
    return { keySet: hasKey(accounts), provider: standing ? providerOfAccount(standing).id : defaultProvider };
  } catch {
    return { keySet: false, provider: defaultProvider };
  }
};

const namesByID = (items: Item[], field: string): Map<string, string> => {
  const out = new Map<string, string>();
  for (const item of items) {
    const id = text(item.id);
    if (id !== "") out.set(id, text(item[field]));
  }
  return out;
};

const firstNonEmpty = (a: string | undefined, b: string) => (a ? a : b);

export const isAgentic = (role: Item): boolean =>
  agenticKinds.includes(text(role.kind)) || (Array.isArray(role.permissions) && role.permissions.includes(agentPermission));

type Seat = { model: string; keySet: boolean; disabled: boolean; needsModel: boolean };

const modelState = ({ model, keySet, disabled, needsModel }: Seat): PageRow => {
  if (disabled) return { model, state: agentStateStopped };
  if (model === "" && !needsModel) return { model: "", state: agentStateRunning };
  if (model === "") return { model: agentModelUnset, state: agentCannotSpeak, action: agentModelUnset };
  if (!keySet) return { model, state: agentStateSkipped, link: agentSkippedTarget };
  return { model, state: agentStateRunning };
};

const agencyRolesOf = async (hubId: string): Promise<Item[]> =>
  roleItems(await callTool(hubId, "agency_list_roles", await draftScope(hubId)));

const listAgentsFromAgency = async (hubId: string): Promise<PageRow[]> =>
  (await agencyRolesOf(hubId))
    .filter(isAgentic)
    .map((role) => ({
      id: idOf(role),
      name: role.name,
      description: role.description,
      works_for: text(role.description),
      model: agentModelUnset,
      state: agentStateNoModel,
    }));

const listAgents = async (hubId: string): Promise<PageRow[]> => {
  const roles = roleItems(await callTool(hubId, "ai_list_roles"));
  const accounts = roleItems(await callTool(hubId, "ai_list_accounts"));
  const agencyRoles = await agencyRolesOf(hubId);
  const models = namesByID(accounts, "model_name");
  const works = namesByID(agencyRoles, "name");
  const { keySet } = await hubModel(hubId);
  const seatsByID = new Map(agencyRoles.filter((seat) => text(seat.id) !== "").map((seat): [string, Item] => [text(seat.id), seat]));
  const seated = new Set(roles.map((role) => text(role.agency_role_id)));
  const unseated: PageRow[] = agencyRoles
    .filter((seat) => isAgentic(seat) && !seated.has(text(seat.id)))
    .map((seat) => ({
      seat_id: seat.id,
      name: seat.name,
      description: seat.description,
      works_for: text(seat.name),
      ...modelState({ model: "", keySet, disabled: false, needsModel: true }),
    }));
  const agents = roles.map((role) => {
    const seat = seatsByID.get(text(role.agency_role_id));
    return {
      id: idOf(role),
      name: role.name,
      description: role.description,
      works_for: firstNonEmpty(works.get(text(role.agency_role_id)), agentWorksForNone),
      edit: agentEditTarget,
      ...modelState({
        model: models.get(text(role.account_id)) ?? "",
        keySet,
        disabled: role.status === roleDisabled,
        needsModel: seat === undefined || isAgentic(seat),
      }),
    };
  });
  return [...agents, ...unseated];
};

export const createAgentForSeat = async (hubId: string, seatId: string, name: string, description: string): Promise<string> => {
  const created = asObject(await callTool(hubId, "ai_create_role", { name, description, status: "enabled" }), "ai_create_role");
  const id = idOf(created);
  if (!id) throw new Error("ai_create_role: the answer held no id");
  await callTool(hubId, "ai_map_role", { roleID: id, account_id: "", agency_role_id: seatId });
  return id;
};

const listAgentsOrDegrade = async (hubId: string): Promise<PageRow[]> => {
  try {
    return await listAgents(hubId);
  } catch (failure) {
    try {
      return await listAgentsFromAgency(hubId);
    } catch {
      throw failure;
    }
  }
};

export const agentsPage: PageModule = {
  spec: {
    id: "agents",
    title: "Agents",
    primary: "",
    tools: ["ai_create_role", "ai_list_roles", "ai_get_role", "ai_list_accounts", "ai_map_role", "agency_list_roles"],
    columns: [
      { key: "name", label: "Agent" },
      { key: "works_for", label: "Works for" },
      { key: "model", label: "Model" },
      { key: "state", label: "State" },
    ],
  },
  rows: (hubId) => listAgentsOrDegrade(hubId),
};
