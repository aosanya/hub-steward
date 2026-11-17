import { useState } from "react";
import { itemsOf } from "../../../../features/backlogs";
import { useWord } from "../../../../features/agency/useWord";
import { callTool } from "../../../../shared/wakala/mcp";
import { MenuEditForm } from "../../MenuEditForm";
import { MenuWindow } from "../../MenuWindow";
import { assetDetailFields, assetReadTool, attributeKeys, attributesOf, conditionWords, loadAsset, withAttributes } from "./assetDetail";

type Item = Record<string, unknown>;

type Category = { title: string; category: string };

const assetList = "assetmanager_asset_list";

const fields = { title: "name", meta: "place" };

const textOf = (value: unknown) => (typeof value === "string" ? value : "");

const editFieldsOf = (asset: Item) => [
  { label: "Name", key: "name", required: true },
  { label: "Category", key: "category" },
  ...(attributesOf(asset) === null ? [] : [{ label: "Condition", key: "condition", choices: conditionWords }]),
];

const updateOf = (asset: Item) => (sent: Record<string, unknown>) => {
  const attributes = withAttributes(asset, Object.fromEntries(attributeKeys.filter((key) => key in sent).map((key) => [key, sent[key]])));
  return {
    assetID: textOf(asset.id),
    name: sent.name ?? textOf(asset.name),
    category: sent.category ?? textOf(asset.category),
    ...(textOf(asset.serial_tag) === "" ? {} : { serial_tag: textOf(asset.serial_tag) }),
    ...(attributes === "" ? {} : { attributes_json: attributes }),
    ...(textOf(asset.updated_at) === "" ? {} : { version: textOf(asset.updated_at) }),
  };
};

const loadCategory = (category: string) => async () => {
  const [assets, locations] = await Promise.all([
    callTool("", assetList, { category }).then(itemsOf) as Promise<Item[]>,
    callTool("", "assetmanager_location_list").then(itemsOf) as Promise<Item[]>,
  ]);
  const nameById = new Map(locations.map((location) => [textOf(location.id), textOf(location.name)]));
  return assets.map((asset) => ({
    id: textOf(asset.id),
    name: textOf(asset.name),
    place: nameById.get(textOf(asset.location_id)) ?? "",
  }));
};

const categoryPage = ({ title: generic, category }: Category) =>
  function AssetCategoryPage() {
    const word = useWord("assetmanager");
    const title = word(generic);
    const [version, setVersion] = useState(0);
    return (
      <MenuWindow
        title={title}
        listKey={version}
        detailKey={version}
        list={{ title, tool: assetList, fields, empty: { words: `No ${title.toLowerCase()} yet.` }, load: loadCategory(category) }}
        detail={{ tool: assetReadTool, fields: assetDetailFields, status: "", load: loadAsset,
          extra: (asset) => (
            <MenuEditForm item={asset} id={textOf(asset.id)} idArg="assetID" tool="assetmanager_asset_update" permission="asset.manage" fields={editFieldsOf(asset)} build={updateOf(asset)} onSaved={() => setVersion((was) => was + 1)} />
          ),
        }}
      />
    );
  };

export const RoutesPage = categoryPage({ title: "Routes", category: "Route" });
export const EquipmentPage = categoryPage({ title: "Equipment", category: "Equipment" });
export const FacilitiesPage = categoryPage({ title: "Facilities", category: "Facility" });
export const BuildingsPage = categoryPage({ title: "Buildings", category: "Building" });
