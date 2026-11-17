import { useState } from "react";
import { useParams } from "react-router-dom";
import { callTool } from "../../../../shared/wakala/mcp";
import { useWord } from "../../../../features/agency/useWord";
import { MenuDetail } from "../../MenuDetail";
import { MenuEditForm } from "../../MenuEditForm";
import { itemOf, textOf } from "./records";

const editFields = [
  { label: "Name", key: "name", required: true },
  { label: "Category", key: "category" },
];

const fields = { Name: "name", Type: "category", Location: "location" };

const placeRead = "assetmanager_asset_read";

const loadPlace = async (placeId: string) => {
  const asset = itemOf(await callTool("", placeRead, { assetID: placeId }));
  const locationId = textOf(asset.location_id);
  const location = locationId ? itemOf(await callTool("", "assetmanager_location_read", { locationID: locationId })) : {};
  return { ...asset, location: textOf(location.name) };
};

export const placeDetail = (onSaved: () => void) => ({
  tool: placeRead,
  fields,
  status: "",
  load: loadPlace,
  extra: (place: Record<string, unknown>) => (
    <MenuEditForm item={place} id={textOf(place.id)} idArg="assetID" tool="assetmanager_asset_update" permission="asset.manage" fields={editFields} keep={["name"]} onSaved={onSaved} />
  ),
});

export function PlacePage() {
  const { placeId } = useParams();
  const word = useWord("digitaltwin");
  const [version, setVersion] = useState(0);
  return <MenuDetail key={version} title={word("Place")} id={placeId} {...placeDetail(() => setVersion((was) => was + 1))} />;
}
