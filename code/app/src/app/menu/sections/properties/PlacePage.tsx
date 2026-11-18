import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useWord } from "../../../../features/agency/useWord";
import { useLoad } from "../../../../features/forms/useLoad";
import { LoadFailed, LoadingLine } from "../../../../shared/ui/LoadState";
import { callTool } from "../../../../shared/wakala/mcp";
import { openAgencyId } from "../../../../shared/wakala/openAgency";
import { Shell } from "../../../Shell";
import { MenuDetail } from "../../MenuDetail";
import { MenuEditForm } from "../../MenuEditForm";
import { PageFrame } from "../../PageFrame";
import { SectionGo } from "../residents/SectionAct";
import { ChatAboutProperty } from "./ChatAboutProperty";
import { PropertyFacts } from "./PropertyFacts";
import { PropertyHoldings } from "./PropertyHoldings";
import { PropertyWorks } from "./PropertyWorks";
import { placePaths } from "./paths";
import { itemOf, parcelOf, placeIdOf, textOf, withParcel } from "./records";

const editFields = [
  { label: "Name", key: "name", required: true },
  { label: "Category", key: "category" },
  { label: "Parcel number", key: "parcel_number" },
];

const placeRead = "assetmanager_asset_read";

export const loadPlace = async (placeId: string): Promise<Record<string, unknown>> => {
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

function PlaceCards({ place }: { place: Record<string, unknown> }) {
  const word = useWord("digitaltwin");
  const id = textOf(place.id);
  const edit = <SectionGo permission="asset.manage" act="Edit" to={placePaths.placeEdit.path({ placeId: id })} />;
  return (
    <>
      <ChatAboutProperty kind="place" id={id} name={textOf(place.name)} back={placePaths.place.path({ placeId: id })} extra={{ place: placeIdOf(place.attributes_json) || "none" }} />
      <PageFrame title={textOf(place.name)} line={textOf(place.category)}>
        <PropertyFacts
          word={`${word("Place")} detail`}
          facts={[["Name", textOf(place.name)], ["Type", textOf(place.category)], ["Location", textOf(place.location)], ["Parcel number", textOf(place.parcel_number)]]}
          foot={edit}
        />
        <PropertyHoldings assetId={id} placeId={placeIdOf(place.attributes_json)} />
        <PropertyWorks assetId={id} />
      </PageFrame>
    </>
  );
}

export const placeDetail = () => ({
  tool: placeRead,
  fields: {},
  status: "",
  load: loadPlace,
  extra: (place: Record<string, unknown>) => <PlaceCards place={place} />,
});

export function PlacePage() {
  const { placeId } = useParams();
  const word = useWord("digitaltwin");
  return <MenuDetail title={word("Place")} id={placeId} {...placeDetail()} />;
}

export function PlaceEditScreen() {
  const { placeId = "" } = useParams();
  const navigate = useNavigate();
  const [saved, setSaved] = useState(0);
  const view = useLoad(() => loadPlace(placeId), `place-edit:${openAgencyId()}:${placeId}:${saved}`);
  const back = () => navigate(placePaths.place.path({ placeId }));
  const name = view.state === "ready" ? textOf(view.data.name) : "";
  return (
    <Shell title="Edit place" titleUnder onBack={back} backLabel={name || "Back"} tabless>
      {view.state === "loading" ? <LoadingLine /> : null}
      {view.state === "error" ? <LoadFailed words="This could not be loaded." /> : null}
      {view.state === "ready" ? (
        <div className="person-page">
          <MenuEditForm
            item={view.data}
            id={placeId}
            idArg="assetID"
            tool="assetmanager_asset_update"
            permission="asset.manage"
            bare
            openCount={1}
            fields={editFields}
            keep={["name"]}
            build={(sent) => parcelBody(sent, view.data)}
            onSaved={() => {
              setSaved((was) => was + 1);
              back();
            }}
            onCancel={back}
          />
        </div>
      ) : null}
    </Shell>
  );
}
