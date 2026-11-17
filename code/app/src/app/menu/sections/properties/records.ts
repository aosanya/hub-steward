import { itemsOf } from "../../../../features/backlogs";
import { callTool } from "../../../../shared/wakala/mcp";

export const digitaltwinModule = "digitaltwin";

export const textOf = (value: unknown) => (typeof value === "string" ? value : "");

export const joined = (parts: string[], separator = " · ") => parts.filter(Boolean).join(separator);

export const dayOf = (stamp: unknown) => textOf(stamp).slice(0, 10);

export const loadRecords = async <Row extends Record<string, string>>(tool: string, row: (record: Record<string, unknown>) => Row) => {
  const records: Record<string, unknown>[] = itemsOf(await callTool("", tool));
  return records.map((record) => ({ id: textOf(record.id), ...row(record) }));
};

export const loadPlaces = () => loadRecords("assetmanager_asset_list", (place) => ({ name: textOf(place.name), category: textOf(place.category) }));
