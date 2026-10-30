import { McpError, callTool } from "../../wakala/mcp";
import { draftScope } from "../draft";
import type { ActionResult } from "../types";
import { isRecord, itemsOf, textOf } from "./groups";

export type UsingScenario = { id: string; name: string };

export type RemoveOutcome = { kind: "sent"; result: ActionResult } | { kind: "refused"; scenarios: UsingScenario[] };

const heldBy = (roleId: string) => (scenario: Record<string, unknown>): boolean =>
  Array.isArray(scenario.actors) && scenario.actors.some((actor) => isRecord(actor) && textOf(actor, "role_id") === roleId);

export const scenariosUsingRole = async (hubId: string, roleId: string): Promise<UsingScenario[]> => {
  const listed = itemsOf(await callTool<unknown>(hubId, "agency_list_scenarios", await draftScope(hubId)));
  return listed.filter(heldBy(roleId)).map((scenario) => ({ id: textOf(scenario, "id"), name: textOf(scenario, "name") }));
};

const usedByMarker = "is still used by";

const namesRefused = (error: unknown): UsingScenario[] | null => {
  if (!(error instanceof McpError)) return null;
  const at = error.message.indexOf(usedByMarker);
  if (at < 0) return null;
  return [...error.message.slice(at + usedByMarker.length).matchAll(/"([^"]*)"/g)].map((match) => ({ id: "", name: match[1] }));
};

export const proposeRemoveRole = async (hubId: string, roleId: string): Promise<RemoveOutcome> => {
  const using = await scenariosUsingRole(hubId, roleId).catch(() => []);
  if (using.length > 0) return { kind: "refused", scenarios: using };
  try {
    await callTool(hubId, "agency_delete_role", { role_id: roleId });
    return { kind: "sent", result: "done" };
  } catch (error) {
    const scenarios = namesRefused(error);
    if (scenarios) return { kind: "refused", scenarios };
    throw error;
  }
};
