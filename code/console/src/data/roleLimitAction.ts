import type { ToolSpec } from "./chatTools";
import { roleLimitKeys, type RoleLimitKey } from "./roleLimits";

export const showRoleLimitFormTool = "show_role_limit_form";

export const roleLimitView = "roleLimit";

export type RoleLimitParams = { limit: RoleLimitKey; role: string; value: number | null };

type Args = Record<string, unknown>;

export const roleLimitSpec: ToolSpec = {
  name: showRoleLimitFormTool,
  description:
    "Fills the form that changes one limit of an AI role in the content area next to this chat for the manager to check. Nothing is recorded until the manager presses Save. Call it when asked to raise, lower or remove one limit of an agent, after looking up the AI roles.",
  parameters: {
    type: "object",
    properties: {
      role: { type: "string", description: "The id of the AI role, as listed by ai_list_roles." },
      limit: { type: "string", enum: [...roleLimitKeys], description: "The key of the limit to change." },
      value: { type: "integer", description: "The new value, zero for none. Leave out when the manager gave none." },
    },
    required: ["limit"],
  },
};

const isRoleLimitKey = (value: unknown): value is RoleLimitKey => roleLimitKeys.some((key) => key === value);

export function roleLimitParamsOf(params: Args): RoleLimitParams | null {
  if (!isRoleLimitKey(params.limit)) return null;
  const { role, value } = params;
  return {
    limit: params.limit,
    role: typeof role === "string" ? role : "",
    value: typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null,
  };
}

export const roleLimitAnswer = (prompt: string, args: Args) => ({
  kind: "action" as const,
  prompt,
  view: roleLimitView,
  title: "",
  params: { ...args },
});

export const roleLimitAction = { spec: roleLimitSpec, answer: roleLimitAnswer };
