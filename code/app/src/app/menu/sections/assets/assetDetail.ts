import { callTool } from "../../../../shared/wakala/mcp";

type Item = Record<string, unknown>;

export const assetReadTool = "assetmanager_asset_read";

export const assetDetailFields = {
  Name: "name",
  Code: "code",
  Category: "category",
  Location: "place",
  "Latest movement": "movement0",
  "Before that": "movement1",
  Earlier: "movement2",
};

const newestMovements = 3;

const textOf = (value: unknown) => (typeof value === "string" ? value : "");

const itemOf = (reply: unknown): Item => {
  const inner = (reply as { item?: unknown } | null)?.item ?? reply;
  return inner && typeof inner === "object" ? (inner as Item) : {};
};

const itemsIn = (reply: unknown): Item[] => {
  const list = (reply as { items?: unknown } | null)?.items;
  return Array.isArray(list) ? (list as Item[]) : [];
};

const newestFirst = (one: Item, two: Item) => textOf(two.occurred_at).localeCompare(textOf(one.occurred_at));

const placeOf = async (locationId: string) =>
  locationId ? textOf(itemOf(await callTool("", "assetmanager_location_read", { id: locationId })).name) : "";

const movementsOf = async (assetId: string) =>
  itemsIn(await callTool("", "assetmanager_movement_list", { asset_id: assetId }))
    .sort(newestFirst)
    .slice(0, newestMovements)
    .map((movement) => textOf(movement.note) || textOf(movement.kind));

export const loadAsset = async (assetId: string) => {
  const asset = itemOf(await callTool("", assetReadTool, { id: assetId }));
  const [place, movements] = await Promise.all([placeOf(textOf(asset.location_id)), movementsOf(assetId)]);
  const latest = Object.fromEntries(movements.map((note, at) => [`movement${at}`, note]));
  return { ...asset, place, ...latest };
};
