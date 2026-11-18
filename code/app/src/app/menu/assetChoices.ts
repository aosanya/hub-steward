import { itemsOf } from "../../features/backlogs";
import type { Choice } from "../../shared/ui/SearchSelect";
import { callTool } from "../../shared/wakala/mcp";

type Raw = Record<string, unknown>;

const assetListTool = "assetmanager_asset_list";

export const noAsset: Choice = { value: "", label: "No asset" };

const textOf = (value: unknown) => (typeof value === "string" ? value : "");

export const assetLabelOf = (name: string, serialTag: string) => [name, serialTag].filter(Boolean).join(" ");

const listAssets = async (): Promise<Raw[]> => itemsOf(await callTool("", assetListTool)) as Raw[];

const labelOf = (asset: Raw) => assetLabelOf(textOf(asset.name), textOf(asset.serial_tag));

export const loadAssetChoices = async (): Promise<Choice[]> => [noAsset, ...(await listAssets()).map((asset) => ({ value: textOf(asset.id), label: labelOf(asset) }))];

export const loadAssetLabels = async (): Promise<Map<string, string>> => new Map((await listAssets()).map((asset) => [textOf(asset.id), labelOf(asset)] as const));
