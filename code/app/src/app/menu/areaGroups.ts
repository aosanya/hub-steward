import { itemsOf } from "../../features/backlogs";
import { callTool } from "../../shared/wakala/mcp";

type Item = Record<string, unknown>;

const lower = (value: unknown) => (typeof value === "string" ? value.toLowerCase() : "");

const fallbackLevel = "neighbourhood";

const areaLevelNames = async (): Promise<string[]> => {
  try {
    const levels = itemsOf(await callTool("", "actor_list_levels")) as Item[];
    const names = levels.filter((level) => level.is_area === true).map((level) => lower(level.name));
    return names.length > 0 ? names : [fallbackLevel];
  } catch {
    return [fallbackLevel];
  }
};

export const areaGroups = async (): Promise<Item[]> => {
  const [names, groups] = await Promise.all([areaLevelNames(), callTool("", "actor_list_groups").then((reply) => itemsOf(reply) as Item[])]);
  return groups.filter((group) => names.includes(lower(group.node_type)));
};
