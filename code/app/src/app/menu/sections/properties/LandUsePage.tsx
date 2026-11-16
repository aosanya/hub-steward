import { MountedMenuList } from "./MountedMenuList";

const fields = { title: "name", meta: "" };

export function LandUsePage() {
  return <MountedMenuList title="Land Use" tool="assetmanager_location_list" fields={fields} empty={{ words: "No areas yet." }} />;
}
