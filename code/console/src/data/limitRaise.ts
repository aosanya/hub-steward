import { callTool } from "../wakala/mcp";
import type { ActionAnswer } from "./chatAnswer";
import type { ToolSpec } from "./chatTools";
import { heldLimitsOf, limitsWithChanges, text, type Loose } from "./modelLimits";
import { pendingRaise, roleLimitKeys, roleLimitsTool, type PendingRaise } from "./roleLimits";

export const showLimitRaiseTool = "show_limit_raise";

export const limitRaiseView = "limitRaise";

export const accountLimitsTool = "ai_set_limits";

export type LimitRaiseAsk = PendingRaise & { id: string; value: number };

export type LimitRaiseApproval = { name: string; tool: string; arguments: Record<string, unknown> };

type Args = Record<string, unknown>;

export const limitRaiseSpec: ToolSpec = {
  name: showLimitRaiseTool,
  description:
    "Shows the manager, in the content area next to this chat, a card that raises the limit which stopped a call, to approve. Nothing is recorded until the manager presses Approve. Call it after ai_check_limits refused a call and the manager wants the limit raised: copy limit, owner, max and used from the refusal.",
  parameters: {
    type: "object",
    properties: {
      limit: { type: "string", enum: [...roleLimitKeys], description: "The limit key the refusal named." },
      owner: { type: "string", enum: ["role", "account"], description: "Whose limit it is, as the refusal named it." },
      id: { type: "string", description: "The id of the AI role when owner is role, of the model account when owner is account." },
      max: { type: "integer", description: "The limit's maximum, as the refusal gave it." },
      used: { type: "integer", description: "The count against it, as the refusal gave it." },
      value: { type: "integer", description: "The new maximum, higher than max." },
    },
    required: ["limit", "owner", "id", "max", "used", "value"],
  },
};

export function limitRaiseParamsOf(params: Args): LimitRaiseAsk | null {
  const pending = pendingRaise({ allowed: false, limit: params.limit, owner: params.owner, max: params.max, used: params.used });
  const { id, value } = params;
  if (!pending || typeof id !== "string" || id === "") return null;
  if (typeof value !== "number" || !Number.isInteger(value) || value <= pending.max) return null;
  return { ...pending, id, value };
}

export const limitRaiseAnswer = (prompt: string, args: Args): ActionAnswer => ({
  kind: "action",
  prompt,
  view: limitRaiseView,
  title: "",
  params: { ...args },
});

export const limitRaiseAction = { spec: limitRaiseSpec, answer: limitRaiseAnswer };

const notHigherWords = "that is not higher than the limit now";

const holderOf = (hubId: string, ask: LimitRaiseAsk): Promise<Loose> =>
  ask.owner === "role"
    ? callTool<Loose>(hubId, "ai_get_role", { roleID: ask.id })
    : callTool<Loose>(hubId, "ai_get_account", { accountID: ask.id });

export async function limitRaiseApproval(hubId: string, ask: LimitRaiseAsk): Promise<LimitRaiseApproval> {
  const held = await holderOf(hubId, ask);
  const now = heldLimitsOf(held)[ask.key];
  if (now === null || ask.value <= now) throw new Error(notHigherWords);
  const limits = limitsWithChanges(held, { [ask.key]: ask.value });
  if (ask.owner === "role") return { name: text(held.name), tool: roleLimitsTool, arguments: { roleID: ask.id, ...limits } };
  return { name: text(held.name) || text(held.model_name), tool: accountLimitsTool, arguments: { accountID: ask.id, ...limits } };
}

export async function applyLimitRaise(hubId: string, ask: LimitRaiseAsk): Promise<void> {
  const approval = await limitRaiseApproval(hubId, ask);
  await callTool(hubId, approval.tool, approval.arguments);
}
