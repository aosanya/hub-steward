import { callTool } from "../wakala/mcp";
import { workingDraftId } from "./draft";
import { itemsOf, text, type Loose } from "./modelLimits";

export const chatPermission = "ai.chat";

export const askingRoleNames = ["Backlog member", "Backlog worker", "Backlog manager"];

export const getAssistantLimitsTool = "ai_get_assistant_limits";

export const setAssistantLimitsTool = "ai_set_assistant_limits";

export type AskingRole = { id: string; name: string; permissions: string[]; may: boolean };

export type AssistantLimits = { day: number | null; month: number | null };

export type AssistantSettings = { draftId: string; roles: AskingRole[]; limits: AssistantLimits };

const negativeLimitWords = "a limit cannot be below zero";

const permissionsOf = (raw: Loose): string[] => (Array.isArray(raw.permissions) ? raw.permissions.filter((code): code is string => typeof code === "string") : []);

const roleOf = (raw: Loose): AskingRole => {
  const permissions = permissionsOf(raw);
  return { id: text(raw.id), name: text(raw.name), permissions, may: permissions.includes(chatPermission) };
};

const numberOrNull = (value: unknown): number | null => (typeof value === "number" && value > 0 ? value : null);

const limitsOf = (raw: unknown): AssistantLimits => {
  const held = (typeof raw === "object" && raw !== null ? raw : {}) as Loose;
  return { day: numberOrNull(held.tokens_per_person_day), month: numberOrNull(held.tokens_per_person_month) };
};

export async function loadAssistantSettings(hubId: string): Promise<AssistantSettings> {
  const draftId = await workingDraftId(hubId);
  const [listed, limits] = await Promise.all([
    callTool<unknown>(hubId, "agency_list_roles", draftId === "" ? {} : { draft_id: draftId }),
    callTool<unknown>(hubId, getAssistantLimitsTool),
  ]);
  const roles = itemsOf(listed)
    .filter((item) => askingRoleNames.includes(text(item.name)))
    .map(roleOf)
    .sort((a, b) => askingRoleNames.indexOf(a.name) - askingRoleNames.indexOf(b.name));
  return { draftId, roles, limits: limitsOf(limits) };
}

const permissionsAfter = (role: AskingRole, may: boolean): string[] => {
  const others = role.permissions.filter((code) => code !== chatPermission);
  return may ? [...others, chatPermission] : others;
};

export async function saveAssistantSettings(hubId: string, before: AssistantSettings, after: AssistantSettings): Promise<void> {
  if ([after.limits.day, after.limits.month].some((value) => value !== null && value < 0)) throw new Error(negativeLimitWords);
  for (const role of after.roles) {
    const was = before.roles.find((held) => held.id === role.id);
    if (!was || was.may === role.may) continue;
    await callTool(hubId, "agency_update_role", {
      ...(before.draftId === "" ? {} : { draft_id: before.draftId }),
      role_id: role.id,
      name: role.name,
      permissions: permissionsAfter(was, role.may),
    });
  }
  await callTool(hubId, setAssistantLimitsTool, {
    tokens_per_person_day: after.limits.day ?? 0,
    tokens_per_person_month: after.limits.month ?? 0,
  });
}
