import { useParams, useSearchParams } from "react-router-dom";
import { useLoad } from "../../../../features/forms/useLoad";
import { openAgencyId } from "../../../../shared/wakala/openAgency";
import { FormScreen } from "../../FormScreen";
import { loadAsset } from "./assetDetail";
import { editFieldsOf, updateOf } from "./assetEdit";
import { loadKeeperChoices } from "./keeperChoices";
import { assetListPath, assetPathOf } from "./paths";

type Item = Record<string, unknown>;

const textOf = (value: unknown) => (typeof value === "string" ? value : "");

const addFields = [
  { label: "Name", key: "name", required: true },
  { label: "Tag", key: "serial_tag", required: true },
];

export function AssetFormScreen() {
  const { id = "" } = useParams();
  const [search] = useSearchParams();
  const category = search.get("category") ?? "";
  const adding = id === "";
  const keepers = useLoad(adding ? async () => [] : loadKeeperChoices, `asset-keepers:${openAgencyId()}:${adding}`);
  const keeperChoices = keepers.state === "ready" ? keepers.data : [];
  return (
    <FormScreen
      id={id}
      word="asset"
      listLabel={category || "Assets"}
      addedTo={assetListPath(category)}
      editedTo={(asset: Item) => assetPathOf(textOf(asset.category), id)}
      permission="asset.manage"
      load={loadAsset}
      nameOf={(asset) => textOf(asset.name)}
      addTool="assetmanager_asset_create"
      addBuild={(sent) => ({ name: textOf(sent.name).trim(), ...(category ? { category } : {}), tracking_mode: "serialized", serial_tag: textOf(sent.serial_tag).trim() })}
      editTool="assetmanager_asset_update"
      idArg="assetID"
      editBuild={updateOf}
      fields={(asset) => (adding ? addFields : editFieldsOf(asset, keeperChoices))}
    />
  );
}
