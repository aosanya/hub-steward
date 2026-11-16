import { useWord } from "../../../../features/agency/useWord";
import { MountedMenuList } from "./MountedMenuList";

const fields = { title: "name", meta: "" };

export function LandUsePage() {
  const word = useWord("digitaltwin");
  return (
    <MountedMenuList
      title={word("Land Use")}
      tool="assetmanager_location_list"
      fields={fields}
      empty={{ words: `No ${word("Areas").toLowerCase()} yet.` }}
    />
  );
}
