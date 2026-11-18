import { itemsOf } from "../../../../features/backlogs";
import { callTool } from "../../../../shared/wakala/mcp";

export const digitaltwinModule = "digitaltwin";

export const tenureList = "digitaltwin_tenure_list";

const nodeList = "digitaltwin_node_list";

export const textOf = (value: unknown) => (typeof value === "string" ? value : "");

export const joined = (parts: string[], separator = " · ") => parts.filter(Boolean).join(separator);

export const dayOf = (stamp: unknown) => textOf(stamp).slice(0, 10);

export const itemOf = (reply: unknown): Record<string, unknown> => {
  const inner = (reply as { item?: unknown } | null)?.item ?? reply;
  return inner && typeof inner === "object" ? (inner as Record<string, unknown>) : {};
};

export const readRecord = async (tool: string, idName: string, id: string) => itemOf(await callTool("", tool, { [idName]: id }));

export const loadRecords = async <Row extends Record<string, string>>(tool: string, row: (record: Record<string, unknown>) => Row) => {
  const records: Record<string, unknown>[] = itemsOf(await callTool("", tool));
  return records.map((record) => ({ id: textOf(record.id), ...row(record) }));
};

const parcelKey = "parcel_number";

const attributesOf = (attributesJson: unknown): Record<string, unknown> => {
  try {
    const parsed: unknown = JSON.parse(textOf(attributesJson));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
};

export const parcelOf = (attributesJson: unknown) => textOf(attributesOf(attributesJson)[parcelKey]);

export const withParcel = (attributesJson: unknown, parcel: string) => {
  const { [parcelKey]: _dropped, ...others } = attributesOf(attributesJson);
  return JSON.stringify(parcel.trim() === "" ? others : { ...others, [parcelKey]: parcel.trim() });
};

export const loadPlaces = () =>
  loadRecords("assetmanager_asset_list", (place) => ({ name: textOf(place.name), category: joined([textOf(place.category), parcelOf(place.attributes_json)]) }));

export const loadNodeNames = async () => {
  try {
    const nodes: Record<string, unknown>[] = itemsOf(await callTool("", nodeList));
    return new Map(nodes.map((node) => [textOf(node.id), textOf(node.name)]));
  } catch {
    return new Map<string, string>();
  }
};
