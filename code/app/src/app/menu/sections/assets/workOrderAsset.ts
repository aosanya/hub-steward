import { itemsOf } from "../../../../features/backlogs";
import { callTool } from "../../../../shared/wakala/mcp";
import { assetReadTool, itemOf, placeOf } from "./assetDetail";

type Item = Record<string, unknown>;

const textOf = (value: unknown) => (typeof value === "string" ? value : "");

export const linkedRefOf = (task: Item) => textOf(task.linked_ref);

const readAsset = async (assetId: string) => itemOf(await callTool("", assetReadTool, { assetID: assetId }));

export const aboutAndPlaceOf = async (task: Item) => {
  const none = { about: "", place: "", aboutId: "", aboutCategory: "" };
  if (linkedRefOf(task) === "") return none;
  try {
    const asset = await readAsset(linkedRefOf(task));
    return { about: textOf(asset.name), place: await placeOf(textOf(asset.location_id)), aboutId: linkedRefOf(task), aboutCategory: textOf(asset.category) };
  } catch {
    return none;
  }
};

const nameById = (rows: Item[]) => new Map(rows.map((row) => [textOf(row.id), textOf(row.name)]));

const placeNameByAssetId = async () => {
  const [assets, locations] = await Promise.all([
    callTool("", "assetmanager_asset_list").then(itemsOf) as Promise<Item[]>,
    callTool("", "assetmanager_location_list").then(itemsOf) as Promise<Item[]>,
  ]);
  const places = nameById(locations);
  return new Map(assets.map((asset) => [textOf(asset.id), places.get(textOf(asset.location_id)) ?? ""]));
};

export const placeLookupFor = async (tasks: Item[]) => {
  const places = tasks.some((task) => linkedRefOf(task) !== "") ? await placeNameByAssetId() : new Map<string, string>();
  return (task: Item) => places.get(linkedRefOf(task)) ?? "";
};
