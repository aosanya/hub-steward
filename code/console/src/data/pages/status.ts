import type { PageRow } from "../../types";
import { callTool } from "../../wakala/mcp";
import { draftScope } from "../draft";
import type { PageModule } from "../types";
import { asObject, hubModel, isAgentic, roleItems, text, type Item } from "./agents";

const statusModelNeeded = "Needed to reply";
const statusModelTarget = "models";
const statusAddModel = "Add a model";
const statusManager = "Hub manager";
const statusMembers = "Members";
const statusAgent = "Agent connected";
const statusAgentLabel = "Agent";
const statusAgentMissing = "No agent yet";
const statusCoordinatorYou = "You";
const statusCoordinatorNone = "No role yet";
const statusMembersOpen = "Open to join";
const statusMembersConfirmed = "Approval required";
const statusMembersClosed = "By invitation";
const statusMembersNone = "No hub yet";
const defaultProvider = "huggingface";
const statusAnd = " and ";
const statusComma = ", ";

const providerLabels = new Map([
  ["huggingface", "Hugging Face"],
  ["claude", "Claude"],
  ["meta", "Meta Model API"],
  ["meta_open", "Meta open weights"],
  ["custom", "Other (OpenAI-compatible)"],
]);

const statusRow = (tile: string, check: string, word: string, detail: string, done: boolean, target: string, more: PageRow = {}): PageRow => ({
  id: tile,
  tile,
  check,
  word,
  detail,
  done,
  target,
  ...more,
});

const coordinatorCheck = (roles: Item[]) => {
  const name = text(roles[0]?.name) || statusManager;
  return roles.length === 0
    ? statusRow("coordinator", name, "missing", statusCoordinatorNone, false, "roles")
    : statusRow("coordinator", name, "ready", statusCoordinatorYou, true, "roles");
};

const joinModeWords = new Map([
  ["open", { word: "open", detail: statusMembersOpen }],
  ["confirmed", { word: "confirmed", detail: statusMembersConfirmed }],
]);

const membersCheck = (agency: Item, joinMode: string) => {
  if (text(agency.name) === "") return statusRow("members", statusMembers, "none", statusMembersNone, false, "users");
  const known = joinModeWords.get(joinMode) ?? { word: "invite", detail: statusMembersClosed };
  return statusRow("members", statusMembers, known.word, known.detail, true, "users");
};

const namesTogether = (names: string[]) =>
  names.length < 2 ? names.join("") : names.slice(0, -1).join(statusComma) + statusAnd + names[names.length - 1];

const agentCheck = (roles: Item[]) => {
  const names = roles.filter(isAgentic).map((role) => text(role.name)).filter((name) => name !== "");
  return names.length > 0
    ? statusRow("agent", namesTogether(names), "ready", statusAgent, true, "agents")
    : statusRow("agent", statusAgentLabel, "missing", statusAgentMissing, false, "agents");
};

export const modelCheck = (keySet: boolean, provider: string): PageRow => {
  if (!keySet) return statusRow("model", "Model key", "missing", statusModelNeeded, false, statusModelTarget);
  const named = provider || defaultProvider;
  const label = providerLabels.get(named) ?? named;
  return statusRow("model", "Model key", "set", `${label} · set`, true, statusModelTarget, { provider: label });
};

const agencyOf = (raw: unknown): Item => {
  const doc = asObject(raw, "agency_get_agency");
  const inner = doc.agency;
  return typeof inner === "object" && inner !== null && !Array.isArray(inner) ? (inner as Item) : doc;
};

const joinModeOf = (raw: unknown): string => text(asObject(raw, "instance_get_join_mode").join_mode);

const rolesOf = async (hubId: string): Promise<Item[]> => roleItems(await callTool(hubId, "agency_list_roles", await draftScope(hubId)));

export const statusChecks = async (hubId: string): Promise<PageRow[]> => {
  const agency = agencyOf(await callTool(hubId, "agency_get_agency"));
  const joinMode = joinModeOf(await callTool(hubId, "instance_get_join_mode"));
  const roles = await rolesOf(hubId);
  return [coordinatorCheck(roles), membersCheck(agency, joinMode), agentCheck(roles)];
};

const listStatus = async (hubId: string): Promise<PageRow[]> => {
  const checks = await statusChecks(hubId);
  const { keySet, provider } = await hubModel(hubId);
  const rows = [...checks, modelCheck(keySet, provider)];
  const ready = rows.filter((row) => row.done === true).length;
  const progress = `${ready} of ${rows.length} ready`;
  return rows.map((row) => ({ ...row, progress }));
};

export const statusPage: PageModule = {
  spec: {
    id: "status",
    title: "Status",
    primary: statusAddModel,
    tools: ["agency_get_agency", "instance_get_join_mode", "agency_list_roles", "agency_list_drafts"],
    columns: [
      { key: "check", label: "Check" },
      { key: "detail", label: "Detail" },
      { key: "done", label: "Done" },
      { key: "progress", label: "Progress" },
    ],
  },
  rows: (hubId) => listStatus(hubId),
};
