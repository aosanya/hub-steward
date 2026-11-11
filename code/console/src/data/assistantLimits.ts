import { callTool } from "../wakala/mcp";
import { workingDraftId } from "./draft";
import { itemsOf, text, type Loose } from "./modelLimits";

export const chatPermission = "ai.chat";

export const askingRoleNames = ["Backlog member", "Backlog worker", "Backlog manager"];

export const getAssistantLimitsTool = "ai_get_assistant_limits";

export const setAssistantLimitsTool = "ai_set_assistant_limits";

export const getWorkerCapsTool = "taskmanager_worker_caps_read";

export const setWorkerCapsTool = "taskmanager_worker_caps_set";

export type WorkerDefaults = { input: number; output: number; minutes: number };

export const startingWorkerDefaults: WorkerDefaults = { input: 500000, output: 100000, minutes: 15 };

export type AskingRole = { id: string; name: string; permissions: string[]; may: boolean };

export type AssistantLimits = { day: number | null; month: number | null; ownerDay: number | null; ownerMonth: number | null };

export type AssistantSettings = { draftId: string; roles: AskingRole[]; limits: AssistantLimits; workers: WorkerDefaults };

const negativeLimitWords = "a limit cannot be below zero";

const wholeCapWords = "a worker cap is a whole number above zero";

const secondsPerMinute = 60;

const positive = (value: unknown, otherwise: number) => (typeof value === "number" && value > 0 ? value : otherwise);

const workersOf = (raw: unknown): WorkerDefaults => {
  const held = (typeof raw === "object" && raw !== null ? raw : {}) as Loose;
  return {
    input: positive(held.input_tokens, startingWorkerDefaults.input),
    output: positive(held.output_tokens, startingWorkerDefaults.output),
    minutes: Math.max(1, Math.round(positive(held.runtime_seconds, startingWorkerDefaults.minutes * secondsPerMinute) / secondsPerMinute)),
  };
};

const unreadable = () => undefined;

const wholeAboveZero = (value: number) => Number.isInteger(value) && value > 0;

const permissionsOf = (raw: Loose): string[] => (Array.isArray(raw.permissions) ? raw.permissions.filter((code): code is string => typeof code === "string") : []);

const roleOf = (raw: Loose): AskingRole => {
  const permissions = permissionsOf(raw);
  return { id: text(raw.id), name: text(raw.name), permissions, may: permissions.includes(chatPermission) };
};

const numberOrNull = (value: unknown): number | null => (typeof value === "number" && value > 0 ? value : null);

const limitsOf = (raw: unknown): AssistantLimits => {
  const held = (typeof raw === "object" && raw !== null ? raw : {}) as Loose;
  return {
    day: numberOrNull(held.tokens_per_person_day),
    month: numberOrNull(held.tokens_per_person_month),
    ownerDay: numberOrNull(held.owner_tokens_per_person_day),
    ownerMonth: numberOrNull(held.owner_tokens_per_person_month),
  };
};

export async function loadAssistantSettings(hubId: string): Promise<AssistantSettings> {
  const draftId = await workingDraftId(hubId);
  const [listed, limits, workers] = await Promise.all([
    callTool<unknown>(hubId, "agency_list_roles", draftId === "" ? {} : { draft_id: draftId }),
    callTool<unknown>(hubId, getAssistantLimitsTool),
    callTool<unknown>(hubId, getWorkerCapsTool).catch(unreadable),
  ]);
  const roles = itemsOf(listed)
    .filter((item) => askingRoleNames.includes(text(item.name)))
    .map(roleOf)
    .sort((a, b) => askingRoleNames.indexOf(a.name) - askingRoleNames.indexOf(b.name));
  return { draftId, roles, limits: limitsOf(limits), workers: workersOf(workers) };
}

const permissionsAfter = (role: AskingRole, may: boolean): string[] => {
  const others = role.permissions.filter((code) => code !== chatPermission);
  return may ? [...others, chatPermission] : others;
};

export async function saveAssistantSettings(hubId: string, before: AssistantSettings, after: AssistantSettings): Promise<void> {
  if (Object.values(after.limits).some((value) => value !== null && value < 0)) throw new Error(negativeLimitWords);
  if (!Object.values(after.workers).every(wholeAboveZero)) throw new Error(wholeCapWords);
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
    owner_tokens_per_person_day: after.limits.ownerDay ?? 0,
    owner_tokens_per_person_month: after.limits.ownerMonth ?? 0,
  });
  await saveWorkerDefaults(hubId, before.workers, after.workers);
}

const workersChanged = (before: WorkerDefaults, after: WorkerDefaults) => (Object.keys(after) as (keyof WorkerDefaults)[]).some((key) => before[key] !== after[key]);

export async function saveWorkerDefaults(hubId: string, before: WorkerDefaults, after: WorkerDefaults): Promise<void> {
  if (!workersChanged(before, after)) return;
  await callTool(hubId, setWorkerCapsTool, {
    input_tokens: after.input,
    output_tokens: after.output,
    runtime_seconds: after.minutes * secondsPerMinute,
  });
}
