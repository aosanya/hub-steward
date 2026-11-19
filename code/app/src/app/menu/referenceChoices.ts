import { itemsOf } from "../../features/backlogs";
import type { Choice } from "../../shared/ui/SearchSelect";
import { callTool } from "../../shared/wakala/mcp";
import { namedPersonOf } from "./sections/residents/personName";
import { unnamedPerson } from "./sections/settings/personLabel";

type Item = Record<string, unknown>;

const listPeople = async () => (await callTool("", "actor_list_actors").then(itemsOf)) as Item[];

const personPrefix = "person:";

const bodyPrefix = "body:";

const listGroups = async () => (await callTool("", "actor_list_groups").then(itemsOf)) as Item[];

const nameOfGroup = (group: Item) => (typeof group.name === "string" ? group.name : "");

export const loadHolderChoices = async (): Promise<Choice[]> => {
  const [people, groups] = await Promise.all([listPeople(), listGroups().catch((): Item[] => [])]);
  const persons = people.flatMap((person) => (typeof person.id === "string" && person.id !== "" ? [{ value: `${personPrefix}${person.id}`, label: namedPersonOf(person) || unnamedPerson }] : []));
  const bodies = groups.map(nameOfGroup).filter((name) => name !== "").map((name) => ({ value: `${bodyPrefix}${name}`, label: name }));
  return [...persons, ...bodies];
};

export const holderArgs = (value: string, choices: Choice[]) => {
  const label = choices.find((choice) => choice.value === value)?.label ?? "";
  return value.startsWith(personPrefix) ? { holder: label, holder_actor_id: value.slice(personPrefix.length) } : { holder: label };
};

export const loadPersonIdChoices = async (): Promise<Choice[]> =>
  (await listPeople()).flatMap((person) => (typeof person.id === "string" && person.id !== "" ? [{ value: person.id, label: namedPersonOf(person) || unnamedPerson }] : []));
