import { callTool } from "../wakala/mcp";
import type { ToolDrawing } from "./actionSchema";
import { heldLimitKeys, heldLimitsOf, itemsOf, limitsWithChanges, text, type HeldLimitKey, type HeldLimits, type Loose } from "./modelLimits";

export const roleLimitKeys = heldLimitKeys;

export type RoleLimitKey = HeldLimitKey;

export type RoleLimits = HeldLimits;

export type LimitedRole = { id: string; name: string; accountId: string; limits: RoleLimits };

export type PendingRaise = { key: RoleLimitKey; owner: "role" | "account"; max: number; used: number };

export const roleLimitsTool = "ai_set_role_limits";

const needsRoleWords = "choose an agent";
const negativeLimitWords = "a limit cannot be below zero";
const notUnderstoodWords = "that was not understood";
const unknownLimitWords = "that is not a limit";

const isRoleLimitKey = (value: unknown): value is RoleLimitKey => roleLimitKeys.some((key) => key === value);

const roleOf = (raw: Loose): LimitedRole => ({
  id: text(raw.id),
  name: text(raw.name),
  accountId: text(raw.account_id),
  limits: heldLimitsOf(raw),
});

export const roleLimitDrawing = (key: RoleLimitKey): ToolDrawing => ({
  tool: roleLimitsTool,
  show: ["roleID", key],
  shape: { roleID: { type: "string" }, [key]: { type: "integer" } },
});

export async function limitedRoles(hubId: string): Promise<LimitedRole[]> {
  const listed = itemsOf(await callTool(hubId, "ai_list_roles"));
  return listed.filter((item) => text(item.id) !== "").map(roleOf);
}

export type RoleLimitArguments = RoleLimits & { roleID: string };

export async function roleLimitArguments(hubId: string, roleId: string, key: RoleLimitKey, value: number): Promise<RoleLimitArguments> {
  if (!roleId) throw new Error(needsRoleWords);
  if (!isRoleLimitKey(key)) throw new Error(unknownLimitWords);
  if (!Number.isInteger(value)) throw new Error(notUnderstoodWords);
  if (value < 0) throw new Error(negativeLimitWords);
  const held = await callTool<Loose>(hubId, "ai_get_role", { roleID: roleId });
  return { roleID: roleId, ...limitsWithChanges(held, { [key]: value }) };
}

export async function setRoleLimit(hubId: string, roleId: string, key: RoleLimitKey, value: number): Promise<void> {
  await callTool(hubId, roleLimitsTool, await roleLimitArguments(hubId, roleId, key, value));
}

export const pendingRaise = (decision: unknown): PendingRaise | null => {
  if (typeof decision !== "object" || decision === null) return null;
  const { allowed, limit, owner, max, used } = decision as Loose;
  if (allowed !== false || !isRoleLimitKey(limit)) return null;
  if (owner !== "role" && owner !== "account") return null;
  if (typeof max !== "number" || typeof used !== "number") return null;
  return { key: limit, owner, max, used };
};
