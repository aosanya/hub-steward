import { callTool } from "../wakala/mcp";
import { itemsOf, text, type LimitKey, type ModelAccount } from "./modelLimits";

export type LimitUse = { key: LimitKey; max: number; used: number | null };

export const unassignedRole = "unassigned";

export type RoleUse = { id: string; name: string; today: number; month: number; requests: number; share: number };

export type ModelUse = { rows: LimitUse[]; reached: string; roles: RoleUse[] | null };

type Counted = { limit?: string; max?: number; used?: number };

type Report = { counts?: Counted[] | null };

type Resolved = { limits?: Counted[] | null };

type Decision = { allowed?: boolean; reason?: string };

const countNames: Record<string, LimitKey> = {
  "requests per minute": "requests_per_minute",
  "requests per day": "requests_per_day",
  "daily token": "tokens_per_day",
  "monthly token": "tokens_per_month",
  "weekly request": "requests_per_week",
  "weekly token": "tokens_per_week",
};

const nameOfCount = (key: LimitKey) => Object.keys(countNames).find((name) => countNames[name] === key) ?? "";

const useOrder: LimitKey[] = [
  "tokens_per_call",
  "tokens_per_day",
  "tokens_per_week",
  "tokens_per_month",
  "requests_per_day",
  "requests_per_week",
  "requests_per_minute",
];

export const shareOf = (used: number, max: number) => (max > 0 ? Math.round((used * 100) / max) : 0);

export const isReached = (row: LimitUse) => row.used !== null && row.used >= row.max;

const sentenceOf = (reason: string) => {
  const trimmed = reason.trim();
  if (trimmed === "") return "";
  const capital = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  return capital.endsWith(".") ? capital : capital + ".";
};

const rowsOf = (account: ModelAccount, report: Report): LimitUse[] => {
  const counts = report.counts ?? [];
  const rows = useOrder.map((key): LimitUse => {
    if (key === "tokens_per_call") return { key, max: account.limits[key] ?? 0, used: null };
    const found = counts.find((count) => count.limit === nameOfCount(key));
    return { key, max: found?.max ?? account.limits[key] ?? 0, used: found?.used ?? 0 };
  });
  return rows.filter((row) => row.max > 0);
};

const reachedSentence = async (hubId: string, account: ModelAccount): Promise<string> => {
  try {
    const decision = await callTool<Decision>(hubId, "ai_check_limits", { account_id: account.id, role_limits: {} });
    return decision.allowed === false ? sentenceOf(text(decision.reason)) : "";
  } catch {
    return "";
  }
};

const usedBy = (resolved: Resolved, name: string) => resolved.limits?.find((limit) => limit.limit === name)?.used ?? 0;

const roleUses = async (hubId: string, account: ModelAccount, report: Report): Promise<RoleUse[]> => {
  const listed = itemsOf(await callTool(hubId, "ai_list_roles")).filter((role) => text(role.account_id) === account.id);
  const counted = await Promise.all(
    listed.map(async (role) => {
      const resolved = await callTool<Resolved>(hubId, "ai_resolve_role", { roleID: text(role.id) });
      return {
        id: text(role.id),
        name: text(role.name),
        today: usedBy(resolved, nameOfCount("tokens_per_day")),
        month: usedBy(resolved, nameOfCount("tokens_per_month")),
        requests: usedBy(resolved, nameOfCount("requests_per_day")),
      };
    }),
  );
  const remainder = (name: string, taken: (role: (typeof counted)[number]) => number) =>
    Math.max(0, usedBy({ limits: report.counts }, name) - counted.reduce((sum, role) => sum + taken(role), 0));
  const unassigned = {
    id: unassignedRole,
    name: "",
    today: remainder(nameOfCount("tokens_per_day"), (role) => role.today),
    month: remainder(nameOfCount("tokens_per_month"), (role) => role.month),
    requests: remainder(nameOfCount("requests_per_day"), (role) => role.requests),
  };
  if (unassigned.today + unassigned.month + unassigned.requests > 0) counted.push(unassigned);
  const monthTotal = counted.reduce((sum, role) => sum + role.month, 0);
  return counted.map((role) => ({ ...role, share: shareOf(role.month, monthTotal) })).sort((a, b) => b.month - a.month);
};

export async function modelUsage(hubId: string, account: ModelAccount): Promise<ModelUse> {
  const report = await callTool<Report>(hubId, "ai_list_usage", { accountID: account.id });
  const roles = await roleUses(hubId, account, report).then(
    (found) => found,
    () => null,
  );
  const rows = rowsOf(account, report);
  const reached = rows.some(isReached) ? await reachedSentence(hubId, account) : "";
  return { rows, reached, roles };
}
