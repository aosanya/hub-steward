import type { PageRow } from "../../types";
import { callTool } from "../../wakala/mcp";
import type { ActionResult, ActionRun, PageModule } from "../types";

type Item = Record<string, unknown>;

const hubNameMaxLength = 120;

const isRecord = (value: unknown): value is Item => typeof value === "object" && value !== null && !Array.isArray(value);

const text = (value: unknown) => (typeof value === "string" ? value : "");

const trimmed = (values: Item, key: string) => text(values[key]).trim();

const agencyOf = async (hubId: string): Promise<Item> => {
  const answer = await callTool<unknown>(hubId, "agency_get_agency");
  if (!isRecord(answer)) throw new Error("agency_get_agency: the answer was not an agency");
  return isRecord(answer.agency) ? answer.agency : answer;
};

const rows = async (hubId: string): Promise<PageRow[]> => {
  const agency = await agencyOf(hubId);
  return [{ name: text(agency.name), id: text(agency.id), purpose: text(agency.description) }];
};

const propose = async (hubId: string, kind: string, summary: string, payload: Item): Promise<ActionResult> => {
  await callTool(hubId, "agency_propose_write", { kind, summary, payload: JSON.stringify(payload) });
  return "accepted";
};

const saveProfile: ActionRun = async (hubId, values) => {
  const name = trimmed(values, "name");
  if (!name) throw new Error("name is required");
  await callTool(hubId, "agency_update_agency", { name, description: trimmed(values, "description") });
  return "done";
};

const renameHub: ActionRun = async (hubId, values) => {
  const name = trimmed(values, "name");
  if (!name) throw new Error("name is required");
  if (Array.from(name).length > hubNameMaxLength) throw new Error(`name is longer than ${hubNameMaxLength} characters`);
  return propose(hubId, "instance_rename", "Rename this hub to " + name, { name });
};

export const profilePage: PageModule = {
  spec: {
    id: "profile",
    title: "Profile",
    primary: "Save changes",
    tools: ["agency_get_agency", "agency_update_agency"],
    columns: [
      { key: "name", label: "Name" },
      { key: "purpose", label: "Purpose" },
      { key: "id", label: "Id" },
    ],
  },
  rows,
  actions: { profile: saveProfile, hubname: renameHub },
};
