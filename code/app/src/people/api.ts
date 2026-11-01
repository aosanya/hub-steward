import { callTool } from "../wakala/mcp";

export type Person = { id: string; name: string };
export type Names = Map<string, string>;

export const GROUP_COORDINATOR = "Group coordinator";

const text = (value: unknown) => (typeof value === "string" ? value : value == null ? "" : String(value));

export const peopleOf = (reply: any): Person[] =>
  (Array.isArray(reply) ? reply : Array.isArray(reply?.items) ? reply.items : [])
    .map((a: any) => ({ id: text(a?.id), name: text(a?.display_name).trim() }))
    .filter((p: Person) => p.id !== "" && p.name !== "");

export const namesOf = (people: Person[]): Names => new Map(people.map((p) => [p.id, p.name]));

export const listPeople = async (): Promise<Person[]> => peopleOf(await callTool("", "actor_list_actors"));
