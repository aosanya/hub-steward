import { MountedMenuList } from "./MountedMenuList";

const fields = { title: "name", meta: "" };

export function OwnershipPage() {
  return <MountedMenuList title="Ownership & Tenure" tool="assetmanager_asset_list" fields={fields} empty={{ words: "No properties yet." }} />;
}
