import { listAgents } from "../../../../features/people/api";
import { readActor } from "../residents/PersonScreen";
import { namedPersonOf } from "../residents/personName";
import { unnamedPerson } from "../settings/personLabel";

type Item = Record<string, unknown>;

const agentKind = "agent";

const actorKind = "actor";

const textOf = (value: unknown) => (typeof value === "string" ? value : "");

export const actorNameOf = async (id: string) => namedPersonOf(await readActor(id)) || unnamedPerson;

const settled = async (read: () => Promise<string>) => {
  try {
    return await read();
  } catch {
    return "";
  }
};

const actorNames = async (tasks: Item[]) => {
  const ids = [...new Set(tasks.filter((task) => textOf(task.assignee_kind) === actorKind).map((task) => textOf(task.assigned_to)).filter((id) => id !== ""))];
  return new Map(await Promise.all(ids.map(async (id) => [id, await settled(() => actorNameOf(id))] as const)));
};

const agentNames = async (tasks: Item[]) => {
  const wanted = tasks.some((task) => textOf(task.assignee_kind) === agentKind);
  const agents = wanted ? await listAgents().catch(() => []) : [];
  return new Map(agents.map((agent) => [agent.id, agent.name]));
};

export const assigneeLookupFor = async (tasks: Item[]) => {
  const [actors, agents] = await Promise.all([actorNames(tasks), agentNames(tasks)]);
  return (task: Item) => {
    const id = textOf(task.assigned_to);
    if (id === "") return "";
    return (textOf(task.assignee_kind) === actorKind ? actors : agents).get(id) ?? "";
  };
};
