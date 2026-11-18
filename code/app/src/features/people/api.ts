import { callTool } from "../../shared/wakala/mcp";

export type Person = { id: string; name: string };
export type Names = Map<string, string>;

export const GROUP_COORDINATOR = "Group coordinator";

const text = (value: unknown) => (typeof value === "string" ? value : value == null ? "" : String(value));

export const peopleOf = (reply: any): Person[] =>
  (Array.isArray(reply) ? reply : Array.isArray(reply?.items) ? reply.items : [])
    .map((a: any) => ({ id: text(a?.id), name: text(a?.display_name).trim() }))
    .filter((p: Person) => p.id !== "" && p.name !== "");

export const namesOf = (people: Person[]): Names => new Map(people.map((p) => [p.id, p.name]));

export const agentListTool = "taskmanager_agent_list";

export type Agent = { id: string; agentId: string; name: string };

const rowsOf = (reply: unknown): Record<string, unknown>[] => {
  const rows = Array.isArray(reply) ? reply : Array.isArray((reply as { items?: unknown } | null)?.items) ? (reply as { items: unknown[] }).items : [];
  return rows.filter((row): row is Record<string, unknown> => typeof row === "object" && row !== null);
};

export const agentsOf = (reply: unknown): Agent[] =>
  rowsOf(reply).map((row) => ({ id: text(row.id), agentId: text(row.agent_id), name: text(row.display_name).trim() || text(row.agent_id) }));

export const listAgents = async (): Promise<Agent[]> => agentsOf(await callTool("", agentListTool, {}));

export const listPeople = async (): Promise<Person[]> => peopleOf(await callTool("", "actor_list_actors"));
