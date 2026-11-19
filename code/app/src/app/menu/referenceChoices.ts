import { itemsOf } from "../../features/backlogs";
import type { Choice } from "../../shared/ui/SearchSelect";
import { callTool } from "../../shared/wakala/mcp";
import { namedPersonOf } from "./sections/residents/personName";
import { unnamedPerson } from "./sections/settings/personLabel";

type Item = Record<string, unknown>;

const listPeople = async () => (await callTool("", "actor_list_actors").then(itemsOf)) as Item[];

export const loadPersonNameChoices = async (): Promise<Choice[]> =>
  (await listPeople()).map(namedPersonOf).filter((name) => name !== "").map((name) => ({ value: name, label: name }));

export const loadPersonIdChoices = async (): Promise<Choice[]> =>
  (await listPeople()).flatMap((person) => (typeof person.id === "string" && person.id !== "" ? [{ value: person.id, label: namedPersonOf(person) || unnamedPerson }] : []));
