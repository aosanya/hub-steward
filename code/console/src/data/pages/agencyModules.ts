import { callTool } from "../../wakala/mcp";
import { draftScope } from "../draft";
import { itemsOf, textOf, type Item } from "./groups";
import { workingDraft } from "./workflowDesign";

export type AgencyModule = {
  id: string;
  code: string;
  name: string;
  description: string;
  locked: boolean;
  enabled: boolean;
  explicit: boolean;
  neededBySteps: boolean;
};

export type ModuleHold = "locked" | "steps" | "required" | "free";

const flagOf = (item: Item, key: string) => item[key] === true;

const moduleOf = (item: Item): AgencyModule => ({
  id: textOf(item, "id"),
  code: textOf(item, "code"),
  name: textOf(item, "name") || textOf(item, "code"),
  description: textOf(item, "description"),
  locked: flagOf(item, "locked"),
  enabled: flagOf(item, "enabled"),
  explicit: flagOf(item, "explicit"),
  neededBySteps: flagOf(item, "needed_by_steps"),
});

export const holdOf = (module: AgencyModule): ModuleHold => {
  if (module.locked) return "locked";
  if (module.explicit) return "free";
  if (module.neededBySteps) return "steps";
  return module.enabled ? "required" : "free";
};

export async function loadModules(hubId: string): Promise<AgencyModule[]> {
  const answer = await callTool<unknown>(hubId, "agency_list_modules", await draftScope(hubId));
  return itemsOf(answer)
    .map(moduleOf)
    .filter((module) => module.id !== "");
}

export async function setModuleEnabled(hubId: string, moduleId: string, enabled: boolean): Promise<void> {
  await callTool(hubId, "agency_set_module_enabled", {
    draft_id: await workingDraft(hubId),
    module_id: moduleId,
    enabled,
  });
}
