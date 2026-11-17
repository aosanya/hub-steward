import { itemsOf } from "../../../../features/backlogs";
import type { Choice } from "../../../../shared/ui/SearchSelect";
import { callTool } from "../../../../shared/wakala/mcp";
import { personNameOf } from "../residents/personName";

type Item = Record<string, unknown>;

const textOf = (value: unknown) => (typeof value === "string" ? value : "");

const named = (items: Item[], nameOf: (item: Item) => string): Choice[] =>
  items.map((item) => ({ value: textOf(item.id), label: nameOf(item) })).filter((choice) => choice.value !== "" && choice.label !== "");

export const loadKeeperChoices = async (): Promise<Choice[]> => {
  const [people, groups] = await Promise.all([callTool("", "actor_list_actors").then(itemsOf), callTool("", "actor_list_groups").then(itemsOf)]);
  return [...named(people as Item[], personNameOf), ...named(groups as Item[], (group) => textOf(group.name))];
};
