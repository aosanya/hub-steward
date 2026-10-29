import type { ToolInfo } from "../../wakala/mcp";

const text = { type: "string" };

const tool = (name: string, properties: Record<string, object>, required: string[]): ToolInfo => ({
  name,
  description: name,
  inputSchema: { type: "object", properties: { instance_id: text, ...properties }, required: ["instance_id", ...required], additionalProperties: false },
});

export const offeredTools: ToolInfo[] = [
  tool("actor_invite_to_group", { group_id: text, actor_id: text, actor_code: text, expires_at: text }, ["group_id"]),
  tool("agency_create_goal", { draft_id: text, title: text, description: text, ordinality: { type: "integer" } }, ["draft_id", "title"]),
  tool("agency_create_objective", { draft_id: text, goal_id: text, title: text, description: text }, ["draft_id", "goal_id", "title"]),
  tool("agency_create_role", { draft_id: text, name: text, description: text, permissions: { type: "array", items: text } }, ["draft_id", "name"]),
  tool("agency_update_agency", { name: text, description: text, enabled: { type: "boolean" } }, ["name"]),
  tool("instance_rename", { name: text }, ["name"]),
  tool("instance_set_join_mode", { join_mode: { type: "string", description: "open or confirmed" } }, ["join_mode"]),
];
