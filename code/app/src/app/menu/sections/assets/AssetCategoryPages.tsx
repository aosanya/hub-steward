import { useState } from "react";
import { itemsOf } from "../../../../features/backlogs";
import { useWord } from "../../../../features/agency/useWord";
import { useLoad } from "../../../../features/forms/useLoad";
import type { Choice } from "../../../../shared/ui/SearchSelect";
import { callTool } from "../../../../shared/wakala/mcp";
import { openAgencyId } from "../../../../shared/wakala/openAgency";
import { MenuWindow } from "../../MenuWindow";
import { useChosenItem } from "../settings/RecordPage";
import { AssetPanel } from "./AssetPanels";
import { loadKeeperChoices } from "./keeperChoices";
import { assetReadTool, attributeKeys, attributesOf, conditionWords, loadAsset, withAttributes } from "./assetDetail";

type Item = Record<string, unknown>;

type Category = { title: string; category: string };

const assetList = "assetmanager_asset_list";

const fields = { title: "name", meta: "place" };

const textOf = (value: unknown) => (typeof value === "string" ? value : "");

const editFieldsOf = (asset: Item, keepers: Choice[]) => [
  { label: "Name", key: "name", required: true },
  { label: "Category", key: "category" },
  ...(attributesOf(asset) === null
    ? []
    : [
        { label: "Condition", key: "condition", choices: conditionWords },
        ...(keepers.length === 0 ? [] : [{ label: "Kept by", key: "keeper", choices: keepers }]),
      ]),
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
    const keepers = useLoad(loadKeeperChoices, `keepers:${openAgencyId()}`);
    const keeperChoices = keepers.state === "ready" ? keepers.data : [];
    const startAt = useChosenItem();
    return (
      <MenuWindow
        title={title}
        withTabs
        bandless
        detailAlone
        startAt={startAt}
        listKey={version}
        detailKey={version}
        list={{ title, tool: assetList, fields, empty: { words: `No ${title.toLowerCase()} yet.` }, load: loadCategory(category) }}
        detail={{ tool: assetReadTool, fields: {}, status: "", load: loadAsset,
          extra: (asset) => <AssetPanel asset={asset} fields={editFieldsOf(asset, keeperChoices)} build={updateOf(asset)} onSaved={() => setVersion((was) => was + 1)} />,
        }}
      />
    );
  };

export const RoutesPage = categoryPage({ title: "Routes", category: "Route" });
export const EquipmentPage = categoryPage({ title: "Equipment", category: "Equipment" });
export const FacilitiesPage = categoryPage({ title: "Facilities", category: "Facility" });
export const BuildingsPage = categoryPage({ title: "Buildings", category: "Building" });
