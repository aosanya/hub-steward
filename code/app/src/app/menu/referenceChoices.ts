import { itemsOf } from "../../features/backlogs";
import type { Choice } from "../../shared/ui/SearchSelect";
import { callTool } from "../../shared/wakala/mcp";
import { personNameOf } from "./sections/residents/personName";

type Item = Record<string, unknown>;

export const loadPersonNameChoices = async (): Promise<Choice[]> => {
  const people = (await callTool("", "actor_list_actors").then(itemsOf)) as Item[];
  return people.map(personNameOf).filter((name) => name !== "").map((name) => ({ value: name, label: name }));
};
