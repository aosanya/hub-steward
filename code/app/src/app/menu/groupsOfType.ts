import { itemsOf } from "../../features/backlogs";
import { callTool } from "../../shared/wakala/mcp";

type Item = Record<string, unknown>;

const typeOf = (group: Item) => (typeof group.node_type === "string" ? group.node_type.toLowerCase() : "");

export const groupsOfType = async (type: string): Promise<Item[]> =>
  (itemsOf(await callTool("", "actor_list_groups")) as Item[]).filter((group) => typeOf(group) === type.toLowerCase());
