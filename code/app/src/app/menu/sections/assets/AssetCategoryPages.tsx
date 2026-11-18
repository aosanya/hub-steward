import { itemsOf } from "../../../../features/backlogs";
import { useWord } from "../../../../features/agency/useWord";
import { callTool } from "../../../../shared/wakala/mcp";
import { MenuWindow } from "../../MenuWindow";
import { useChosenItem } from "../settings/RecordPage";
import { AddButton } from "../../AddButton";
import { AssetPanel } from "./AssetPanels";
import { assetReadTool, loadAsset } from "./assetDetail";
import { assetPaths } from "./paths";

type Item = Record<string, unknown>;

type Category = { title: string; category: string };

const assetList = "assetmanager_asset_list";

const fields = { title: "name", meta: "place" };

const textOf = (value: unknown) => (typeof value === "string" ? value : "");

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
    const startAt = useChosenItem();
    return (
      <MenuWindow
        title={title}
        withTabs
        bandless
        detailAlone
        above={<AddButton permission="asset.manage" label="Add asset" to={assetPaths.assetNew.path({ category })} />}
        startAt={startAt}
        list={{ title, tool: assetList, fields, empty: { words: `No ${title.toLowerCase()} yet.` }, load: loadCategory(category) }}
        detail={{ tool: assetReadTool, fields: {}, status: "", load: loadAsset,
          extra: (asset) => <AssetPanel asset={asset} />,
        }}
      />
    );
  };

export const RoutesPage = categoryPage({ title: "Routes", category: "Route" });
export const EquipmentPage = categoryPage({ title: "Equipment", category: "Equipment" });
export const FacilitiesPage = categoryPage({ title: "Facilities", category: "Facility" });
export const BuildingsPage = categoryPage({ title: "Buildings", category: "Building" });
