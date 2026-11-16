import { useWord } from "../../../../features/agency/useWord";
import { MountedMenuList } from "./MountedMenuList";

const fields = { title: "name", meta: "" };

export function OwnershipPage() {
  const word = useWord("digitaltwin");
  return (
    <MountedMenuList
      title={word("Ownership & Tenure")}
      tool="assetmanager_asset_list"
      fields={fields}
      empty={{ words: `No ${word("Properties").toLowerCase()} yet.` }}
    />
  );
}
