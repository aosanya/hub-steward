import { itemsOf } from "../../features/backlogs";
import type { Choice } from "../../shared/ui/SearchSelect";
import { callTool } from "../../shared/wakala/mcp";
import { openAgencyId } from "../../shared/wakala/openAgency";

type Raw = Record<string, unknown>;

const assetListTool = "assetmanager_asset_list";

export const noAsset: Choice = { value: "", label: "No asset" };

const textOf = (value: unknown) => (typeof value === "string" ? value : "");

export const assetLabelOf = (name: string, serialTag: string) => [name, serialTag].filter(Boolean).join(" ");

const reading = new Map<string, Promise<Raw[]>>();

const listAssets = (): Promise<Raw[]> => {
  const key = openAgencyId();
  const running = reading.get(key);
  if (running) return running;
  const started = (async () => itemsOf(await callTool("", assetListTool)) as Raw[])().finally(() => reading.delete(key));
  reading.set(key, started);
  return started;
};

const labelOf = (asset: Raw) => assetLabelOf(textOf(asset.name), textOf(asset.serial_tag));

export const loadAssetChoices = async (): Promise<Choice[]> => [noAsset, ...(await listAssets()).map((asset) => ({ value: textOf(asset.id), label: labelOf(asset) }))];

export const loadAssetLabels = async (): Promise<Map<string, string>> => new Map((await listAssets()).map((asset) => [textOf(asset.id), labelOf(asset)] as const));

export const loadAssetCategories = async (): Promise<Map<string, string>> => new Map((await listAssets()).map((asset) => [textOf(asset.id), textOf(asset.category)] as const));

export const goneAssetWords = "An asset that no longer exists";

export const unreadAssetWords = "An asset that could not be read";

export const assetIdKey = (prompt: string) => `assetId:${prompt}`;
