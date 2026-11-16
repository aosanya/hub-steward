import { useState } from "react";
import { useParams } from "react-router-dom";
import { callTool } from "../../../../shared/wakala/mcp";
import { useWord } from "../../../../features/agency/useWord";
import { MenuDetail } from "../../MenuDetail";
import { MenuEditForm } from "../../MenuEditForm";

const editFields = [
  { label: "Name", key: "name", required: true },
  { label: "Category", key: "category" },
];

const fields = { Name: "name", Type: "category", Location: "location" };

type Fields = { [key: string]: unknown };

const itemOf = (reply: unknown): Fields => {
  const inner = (reply as { item?: unknown } | null)?.item ?? reply;
  return inner && typeof inner === "object" ? (inner as Fields) : {};
};

const textOf = (value: unknown) => (typeof value === "string" ? value : "");

const loadPlace = async (placeId: string) => {
  const asset = itemOf(await callTool("", "assetmanager_asset_read", { assetID: placeId }));
  const locationId = textOf(asset.location_id);
  const location = locationId ? itemOf(await callTool("", "assetmanager_location_read", { locationID: locationId })) : {};
  return { ...asset, location: textOf(location.name) };
};

export function PlacePage() {
  const { placeId } = useParams();
  const word = useWord("digitaltwin");
  const [version, setVersion] = useState(0);
  return (
    <MenuDetail
      key={version}
      title={word("Place")}
      tool="assetmanager_asset_read"
      fields={fields}
      status=""
      id={placeId}
      load={loadPlace}
      extra={(place) => (
        <MenuEditForm item={place} id={textOf(place.id)} idArg="assetID" tool="assetmanager_asset_update" permission="asset.manage" fields={editFields} keep={["name"]} onSaved={() => setVersion((was) => was + 1)} />
      )}
    />
  );
}
