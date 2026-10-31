import { callTool } from "../wakala/mcp";
import { draftScope, type DraftScope } from "./draft";
import { itemsOf } from "./pages/groups";

const partTools = {
  goals: "agency_list_goals",
  objectives: "agency_list_objectives",
  roles: "agency_list_roles",
  assignments: "agency_list_role_assignments",
  workflows: "agency_list_workflows",
  workItems: "agency_list_work_items",
  modules: "agency_list_modules",
  permissions: "agency_list_permissions",
  records: "agency_list_records",
  scenarios: "agency_list_scenarios",
  values: "agency_list_values",
  rules: "agency_list_rules",
  hazards: "agency_list_hazards",
  threats: "agency_list_threats",
  consequences: "agency_list_consequences",
} as const;

type Part = keyof typeof partTools;

export const partsOfPage: Record<string, Part[]> = {
  profile: ["goals", "objectives", "roles", "workflows", "modules"],
  goals: ["goals", "objectives", "roles", "assignments"],
  objectives: [
    "objectives",
    "goals",
    "roles",
    "assignments",
    "workflows",
    "workItems",
    "modules",
  ],
  roles: ["roles", "permissions", "objectives", "assignments", "workflows"],
  workflows: ["workflows", "workItems", "roles", "records", "objectives", "scenarios"],
  risks: ["values", "rules", "goals", "objectives", "roles"],
  bowties: ["values", "rules", "goals", "objectives", "roles"],
  modules: ["modules", "workflows", "workItems"],
  consequences: ["consequences", "hazards"],
  hazards: ["hazards", "consequences"],
  threats: ["threats", "hazards"],
};

const rulesOfPage: Record<string, string> = {
  consequences:
    "Rule for this review: every consequence must be attached to a hazard through its hazard_code. Each consequence with no hazard_code, or with one that matches no hazard listed below, is a finding. Suggest agency_update_consequence with consequence_id, title, description and the hazard_code of the listed hazard it belongs to; when no listed hazard fits, say which hazard has to be created first.",
};

export const maxBackgroundLength = 12000;

export const maxItemLength = 300;

const itemText = (item: unknown): string => {
  const text = JSON.stringify(item) ?? "";
  return text.length > maxItemLength ? `${text.slice(0, maxItemLength - 1)}…` : text;
};

export const sectionOf = (part: string, items: unknown[], limit: number): string => {
  const head = `${part} (${items.length}):`;
  const lines: string[] = [];
  let used = head.length;
  for (const item of items) {
    const line = itemText(item);
    if (used + line.length + 1 > limit) break;
    lines.push(line);
    used += line.length + 1;
  }
  const left = items.length - lines.length;
  return [head, ...lines, ...(left > 0 ? [`(${left} more not shown)`] : [])].join("\n");
};

const argumentsOf = (part: Part, scope: DraftScope): DraftScope => (part === "permissions" ? {} : scope);

export async function draftBackground(hubId: string, page: string): Promise<string> {
  const parts = Object.hasOwn(partsOfPage, page) ? partsOfPage[page] : [];
  if (parts.length === 0) return "";
  const scope = await draftScope(hubId).catch(() => ({}));
  const limit = Math.floor(maxBackgroundLength / parts.length);
  const sections = await Promise.all(
    parts.map(async (part) => {
      try {
        return sectionOf(part, itemsOf(await callTool<unknown>(hubId, partTools[part], argumentsOf(part, scope))), limit);
      } catch {
        return "";
      }
    }),
  );
  const found = sections.filter(Boolean);
  return found.length === 0 ? "" : [rulesOfPage[page], ...found].filter(Boolean).join("\n\n");
}
