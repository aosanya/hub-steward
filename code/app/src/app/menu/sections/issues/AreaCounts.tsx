import { itemsOf } from "../../../../features/backlogs";
import { callTool } from "../../../../shared/wakala/mcp";

type Item = Record<string, unknown>;

export const tallyTool = "forms_catalog_board_item_tally_by_area";

const number = (value: unknown) => (typeof value === "number" ? value : 0);

const live = (area: Item) => (number(area.population) > 0 ? ` · ${number(area.population)} live there` : "");

export const behindAny = (area: Item) => number(area.raised_by) + number(area.me_too) > 0;

const areaLine = (area: Item) => `${String(area.area ?? "") || "No area"} · raised by ${number(area.raised_by)} · ${number(area.me_too)} said Me too${live(area)}`;

export const countedAsPeople = (item: Item, areas: Item[]): Item =>
  areas.length === 0 ? item : { ...item, raised_by: areas.reduce((sum, area) => sum + number(area.raised_by), 0) };

export const areaLinesOf = (item: Item) => (Array.isArray(item.areas) ? (item.areas as Item[]) : []).filter(behindAny).map(areaLine);

export const loadAreaTally = async () => {
  try {
    const byWish = new Map<string, Item[]>();
    (itemsOf(await callTool("", tallyTool, {})) as Item[]).forEach((wish) => byWish.set(String(wish.id ?? ""), Array.isArray(wish.areas) ? (wish.areas as Item[]) : []));
    return byWish;
  } catch {
    return new Map<string, Item[]>();
  }
};
