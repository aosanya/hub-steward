import { itemsOf } from "../../../../features/backlogs";
import { callTool } from "../../../../shared/wakala/mcp";
import { MenuList } from "../../MenuList";

type Item = Record<string, unknown>;

type Category = { title: string; category: string; empty: string };

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

const categoryPage = ({ title, category, empty }: Category) =>
  function AssetCategoryPage() {
    return <MenuList title={title} tool={assetList} fields={fields} empty={{ words: empty }} load={loadCategory(category)} />;
  };

export const RoutesPage = categoryPage({ title: "Routes", category: "Route", empty: "No routes yet." });
export const EquipmentPage = categoryPage({ title: "Equipment", category: "Equipment", empty: "No equipment yet." });
export const FacilitiesPage = categoryPage({ title: "Facilities", category: "Facility", empty: "No facilities yet." });
export const BuildingsPage = categoryPage({ title: "Buildings", category: "Building", empty: "No buildings yet." });
