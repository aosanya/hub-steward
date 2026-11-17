import { callTool } from "../../../../shared/wakala/mcp";
import { personNameOf } from "../residents/personName";
import { loadPerson } from "../residents/PersonScreen";
import { maintenanceHistoryOf } from "./maintenanceHistory";

type Item = Record<string, unknown>;

export const assetReadTool = "assetmanager_asset_read";

export const assetDetailFields = {
  Name: "name",
  Code: "code",
  Category: "category",
  Condition: "condition",
  "Kept by": "keeperName",
  Location: "place",
  "Latest movement": "movement0",
  "Before that": "movement1",
  Earlier: "movement2",
  "Maintenance history": "maintenance0",
  "Maintenance history, second": "maintenance1",
  "Maintenance history, third": "maintenance2",
  "Maintenance history, fourth": "maintenance3",
  "Maintenance history, fifth": "maintenance4",
};

export const conditionWords = ["Good", "Fair", "Poor", "Out of use"];

export const attributeKeys = ["condition", "keeper"];

const newestMovements = 3;

const textOf = (value: unknown) => (typeof value === "string" ? value : "");

export const attributesOf = (asset: Item): Item | null => {
  const raw = asset.attributes_json;
  if (typeof raw !== "string" || raw.trim() === "") return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Item) : null;
  } catch {
    return null;
  }
};

export const withAttributes = (asset: Item, changes: Item) => {
  const current = attributesOf(asset);
  if (current === null || Object.keys(changes).length === 0) return textOf(asset.attributes_json);
  return JSON.stringify({ ...current, ...changes });
};

export const itemOf = (reply: unknown): Item => {
  const inner = (reply as { item?: unknown } | null)?.item ?? reply;
  return inner && typeof inner === "object" ? (inner as Item) : {};
};

const itemsIn = (reply: unknown): Item[] => {
  const list = (reply as { items?: unknown } | null)?.items;
  return Array.isArray(list) ? (list as Item[]) : [];
};

const newestFirst = (one: Item, two: Item) => textOf(two.occurred_at).localeCompare(textOf(one.occurred_at));

export const placeOf = async (locationId: string) =>
  locationId ? textOf(itemOf(await callTool("", "assetmanager_location_read", { locationID: locationId })).name) : "";

const movementsOf = async (assetId: string) =>
  itemsIn(await callTool("", "assetmanager_movement_list", { asset_id: assetId }))
    .sort(newestFirst)
    .slice(0, newestMovements)
    .map((movement) => textOf(movement.note) || textOf(movement.kind));

const personKeeperName = async (keeperId: string) => personNameOf(await loadPerson(keeperId));

const groupKeeperName = async (keeperId: string) => textOf(itemOf(await callTool("", "actor_get_group", { group_id: keeperId })).name);

const nameOrNothing = (named: (keeperId: string) => Promise<string>, keeperId: string) => named(keeperId).catch(() => "");

const keeperNameOf = async (keeperId: string) => {
  if (keeperId === "") return "";
  return (await nameOrNothing(personKeeperName, keeperId)) || nameOrNothing(groupKeeperName, keeperId);
};

export const loadAsset = async (assetId: string) => {
  const asset = itemOf(await callTool("", assetReadTool, { assetID: assetId }));
  const attributes = attributesOf(asset) ?? {};
  const shown = Object.fromEntries(attributeKeys.map((key) => [key, textOf(attributes[key])]));
  const [place, movements, keeperName, maintenance] = await Promise.all([
    placeOf(textOf(asset.location_id)),
    movementsOf(assetId),
    keeperNameOf(textOf(shown.keeper)),
    maintenanceHistoryOf(assetId),
  ]);
  const latest = Object.fromEntries(movements.map((note, at) => [`movement${at}`, note]));
  return { ...asset, place, ...latest, ...maintenance, ...shown, keeperName };
};
