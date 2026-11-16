import { useLocation, useNavigate } from "react-router-dom";
import { useWord } from "../../../../features/agency/useWord";
import { MountedMenuList } from "./MountedMenuList";
import { placePaths } from "./paths";

export const placesTitle = "Places";

const fields = { title: "name", meta: "category" };

export function PlacesPage() {
  const word = useWord("digitaltwin");
  const navigate = useNavigate();
  const here = useLocation();
  const open = (placeId: string) =>
    navigate(placePaths.place.path({ placeId }), { state: { from: { path: `${here.pathname}${here.search}`, title: word(placesTitle) } } });
  return (
    <MountedMenuList
      title={word(placesTitle)}
      tool="assetmanager_asset_list"
      fields={fields}
      empty={{ words: `No ${word("Places").toLowerCase()} yet.` }}
      onChoose={open}
    />
  );
}
