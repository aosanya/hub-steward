import { itemsOf } from "../../../../features/backlogs";
import { callTool } from "../../../../shared/wakala/mcp";
import { useWord } from "../../../../features/agency/useWord";
import { MountedMenuList } from "./MountedMenuList";

const fields = { title: "name", meta: "place" };

const textOf = (value: unknown) => (typeof value === "string" ? value : "");

const loadAddresses = async () => {
  const locations: Record<string, unknown>[] = itemsOf(await callTool("", "assetmanager_location_list"));
  const nameById = new Map(locations.map((location) => [textOf(location.id), textOf(location.name)]));
  return locations.map((location) => ({
    id: textOf(location.id),
    name: textOf(location.name),
    place: nameById.get(textOf(location.parent_location_id)) ?? "",
  }));
};

export function AddressesPage() {
  const word = useWord("digitaltwin");
  return (
    <MountedMenuList
      title={word("Addresses")}
      tool="assetmanager_location_list"
      fields={fields}
      empty={{ words: `No ${word("Addresses").toLowerCase()} yet.` }}
      load={loadAddresses}
    />
  );
}
