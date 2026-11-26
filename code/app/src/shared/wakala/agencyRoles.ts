import { callTool } from "./mcp";

export type AgencyRole = { id: string; code: string; name: string };

const text = (value: unknown) => (typeof value === "string" ? value : "");

const itemsOf = (reply: any): any[] => (Array.isArray(reply) ? reply : Array.isArray(reply?.items) ? reply.items : []);

export const liveDraftId = async (): Promise<string> => {
  const production = itemsOf(await callTool("", "agency_list_publications", {})).filter((publication) => publication?.channel === "production");
  const newest = production.sort((a, b) => Number(b.version ?? 0) - Number(a.version ?? 0))[0];
  return text(newest?.draft_id);
};

export const listAgencyRoles = async (): Promise<AgencyRole[]> => {
  const draft = await liveDraftId();
  if (draft === "") return [];
  return itemsOf(await callTool("", "agency_list_roles", { draft_id: draft })).map((role) => ({ id: text(role?.id), code: text(role?.code), name: text(role?.name) }));
};

export const roleKey = (role: AgencyRole): string => (role.code !== "" ? role.code : role.id);
