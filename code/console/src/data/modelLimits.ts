import { callTool } from "../wakala/mcp";

export const limitKeys = [
  "tokens_per_call",
  "tokens_per_day",
  "tokens_per_week",
  "tokens_per_month",
  "requests_per_minute",
  "requests_per_day",
  "requests_per_week",
] as const;

export const heldLimitKeys = [...limitKeys, "tokens_per_test", "scenarios_at_once"] as const;

export type LimitKey = (typeof limitKeys)[number];

export type HeldLimitKey = (typeof heldLimitKeys)[number];

export type LimitValues = Record<LimitKey, number | null>;

export type HeldLimits = Record<HeldLimitKey, number | null>;

export type ModelAccount = { id: string; name: string; baseUrl: string; modelName: string; limits: HeldLimits };

export type Loose = Record<string, unknown>;

const needsModelWords = "choose a model";
const negativeLimitWords = "a limit cannot be below zero";
const notUnderstoodWords = "that was not understood";
const notListWords = "the answer was not a list";

export const text = (value: unknown): string => (typeof value === "string" ? value : "");

const isObject = (value: unknown): value is Loose => typeof value === "object" && value !== null && !Array.isArray(value);

export const itemsOf = (raw: unknown): Loose[] => {
  const held = Array.isArray(raw) ? raw : isObject(raw) && "items" in raw ? raw.items : undefined;
  if (held === null) return [];
  if (!Array.isArray(held)) throw new Error(notListWords);
  return held.filter(isObject);
};

const limitOf = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) ? value : null);

export const heldLimitsOf = (raw: Loose): HeldLimits =>
  Object.fromEntries(heldLimitKeys.map((key) => [key, limitOf(raw[key])])) as HeldLimits;

export const limitsWithChanges = (raw: Loose, changes: Partial<HeldLimits>): HeldLimits => ({ ...heldLimitsOf(raw), ...changes });

const accountOf = (raw: Loose): ModelAccount => ({
  id: text(raw.id),
  name: text(raw.name),
  baseUrl: text(raw.base_url),
  modelName: text(raw.model_name),
  limits: heldLimitsOf(raw),
});

export async function modelAccounts(hubId: string): Promise<ModelAccount[]> {
  const listed = itemsOf(await callTool(hubId, "ai_list_accounts"));
  return listed.filter((item) => text(item.id) !== "").map(accountOf);
}

const lines = new Map<string, Promise<void>>();

const inLine = <T>(key: string, job: () => Promise<T>): Promise<T> => {
  const result = (lines.get(key) ?? Promise.resolve()).then(job);
  const tail = result.then(
    () => undefined,
    () => undefined,
  );
  lines.set(key, tail);
  void tail.then(() => {
    if (lines.get(key) === tail) lines.delete(key);
  });
  return result;
};

export function changeAccountLimits(hubId: string, accountId: string, changes: Partial<HeldLimits>): Promise<void> {
  return inLine(`${hubId}/${accountId}`, async () => {
    const held = await callTool<Loose>(hubId, "ai_get_account", { accountID: accountId });
    await callTool(hubId, "ai_set_limits", { accountID: accountId, ...limitsWithChanges(held, changes) });
  });
}

export async function saveModelLimits(hubId: string, accountId: string, limits: Partial<HeldLimits>): Promise<void> {
  if (!accountId) throw new Error(needsModelWords);
  const given = heldLimitKeys.filter((key) => limits[key] !== undefined);
  const changes = Object.fromEntries(given.map((key) => [key, limits[key] ?? null]));
  for (const value of Object.values(changes)) {
    if (value === null) continue;
    if (!Number.isInteger(value)) throw new Error(notUnderstoodWords);
    if (value < 0) throw new Error(negativeLimitWords);
  }
  await changeAccountLimits(hubId, accountId, changes);
}
