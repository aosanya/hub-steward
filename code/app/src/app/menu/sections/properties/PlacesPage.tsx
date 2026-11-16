import { useLocation, useNavigate } from "react-router-dom";
import { MountedMenuList } from "./MountedMenuList";
import { placePaths } from "./paths";

export const placesTitle = "Places";

const fields = { title: "name", meta: "category" };

export function PlacesPage() {
  const navigate = useNavigate();
  const here = useLocation();
  const open = (placeId: string) =>
    navigate(placePaths.place.path({ placeId }), { state: { from: { path: `${here.pathname}${here.search}`, title: placesTitle } } });
  return (
    <MountedMenuList
      title={placesTitle}
      tool="assetmanager_asset_list"
      fields={fields}
      empty={{ words: "No places yet." }}
      onChoose={open}
    />
  );
}
