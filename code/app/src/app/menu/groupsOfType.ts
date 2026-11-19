import { itemsOf } from "../../features/backlogs";
import type { Choice } from "../../shared/ui/SearchSelect";
import { callTool } from "../../shared/wakala/mcp";

type Item = Record<string, unknown>;

const typeOf = (group: Item) => (typeof group.node_type === "string" ? group.node_type.toLowerCase() : "");

export const groupsOfType = async (type: string): Promise<Item[]> =>
  (itemsOf(await callTool("", "actor_list_groups")) as Item[]).filter((group) => typeOf(group) === type.toLowerCase());

export const loadGroupChoices = async (): Promise<Choice[]> =>
  (itemsOf(await callTool("", "actor_list_groups")) as Item[]).flatMap((group) =>
    typeof group.id === "string" && typeof group.name === "string" && group.name !== "" ? [{ value: group.id, label: group.name }] : [],
  );
