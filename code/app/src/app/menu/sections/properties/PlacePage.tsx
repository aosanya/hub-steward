import { useState } from "react";
import { useParams } from "react-router-dom";
import { callTool } from "../../../../shared/wakala/mcp";
import { useWord } from "../../../../features/agency/useWord";
import { MenuDetail } from "../../MenuDetail";
import { MenuEditForm } from "../../MenuEditForm";
import { PropertyHoldings } from "./PropertyHoldings";
import { PropertyWorks } from "./PropertyWorks";
import { itemOf, parcelOf, placeIdOf, textOf, withParcel } from "./records";

const editFields = [
  { label: "Name", key: "name", required: true },
  { label: "Category", key: "category" },
  { label: "Parcel number", key: "parcel_number" },
];

const fields = { Name: "name", Type: "category", Location: "location", "Parcel number": "parcel_number" };

const placeRead = "assetmanager_asset_read";

const loadPlace = async (placeId: string) => {
  const asset = itemOf(await callTool("", placeRead, { assetID: placeId }));
  const locationId = textOf(asset.location_id);
  const location = locationId ? itemOf(await callTool("", "assetmanager_location_read", { locationID: locationId })) : {};
  return { ...asset, location: textOf(location.name), parcel_number: parcelOf(asset.attributes_json) };
};

const parcelBody = (sent: Record<string, unknown>, place: Record<string, unknown>) => {
  const { parcel_number: parcel, ...others } = sent;
  const version = textOf(place.updated_at);
  return {
    assetID: textOf(place.id),
    ...(version ? { version } : {}),
    name: textOf(place.name),
    ...others,
    ...(typeof parcel === "string" ? { attributes_json: withParcel(place.attributes_json, parcel) } : {}),
  };
};

export const placeDetail = (onSaved: () => void) => ({
  tool: placeRead,
  fields,
  status: "",
  load: loadPlace,
  extra: (place: Record<string, unknown>) => (
    <>
      <PropertyHoldings assetId={textOf(place.id)} placeId={placeIdOf(place.attributes_json)} />
      <PropertyWorks assetId={textOf(place.id)} />
      <MenuEditForm item={place} id={textOf(place.id)} idArg="assetID" tool="assetmanager_asset_update" permission="asset.manage" fields={editFields} keep={["name"]} build={(sent) => parcelBody(sent, place)} onSaved={onSaved} />
    </>
  ),
});

export function PlacePage() {
  const { placeId } = useParams();
  const word = useWord("digitaltwin");
  const [version, setVersion] = useState(0);
  return <MenuDetail key={version} title={word("Place")} id={placeId} {...placeDetail(() => setVersion((was) => was + 1))} />;
}
