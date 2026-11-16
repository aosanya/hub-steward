import { useParams } from "react-router-dom";
import { callTool } from "../../../../shared/wakala/mcp";
import { MenuDetail } from "../../MenuDetail";

const fields = { Name: "name", Type: "category", Location: "location" };

type Record = { [key: string]: unknown };

const itemOf = (reply: unknown): Record => {
  const inner = (reply as { item?: unknown } | null)?.item ?? reply;
  return inner && typeof inner === "object" ? (inner as Record) : {};
};

const textOf = (value: unknown) => (typeof value === "string" ? value : "");

const loadPlace = async (placeId: string) => {
  const asset = itemOf(await callTool("", "assetmanager_asset_read", { id: placeId }));
  const locationId = textOf(asset.location_id);
  const location = locationId ? itemOf(await callTool("", "assetmanager_location_read", { id: locationId })) : {};
  return { ...asset, location: textOf(location.name) };
};

export function PlacePage() {
  const { placeId } = useParams();
  return <MenuDetail title="Place" tool="assetmanager_asset_read" fields={fields} status="" id={placeId} load={loadPlace} />;
}
