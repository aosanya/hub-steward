import { itemsOf } from "../../../../features/backlogs";
import type { Choice } from "../../../../shared/ui/SearchSelect";
import { callTool } from "../../../../shared/wakala/mcp";
import { loadPersonIdChoices } from "../../referenceChoices";

type Item = Record<string, unknown>;

const textOf = (value: unknown) => (typeof value === "string" ? value : "");

const named = (items: Item[], nameOf: (item: Item) => string): Choice[] =>
  items.map((item) => ({ value: textOf(item.id), label: nameOf(item) })).filter((choice) => choice.value !== "" && choice.label !== "");

export const loadKeeperChoices = async (): Promise<Choice[]> => {
  const [people, groups] = await Promise.all([loadPersonIdChoices(), callTool("", "actor_list_groups").then(itemsOf)]);
  return [...people, ...named(groups as Item[], (group) => textOf(group.name))];
};
