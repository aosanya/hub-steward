import { Route } from "react-router-dom";
import { AddressesPage } from "./AddressesPage";
import { HoldingPage } from "./HoldingPage";
import { LandUsePage } from "./LandUsePage";
import { OwnershipPage } from "./OwnershipPage";
import { PlacePage } from "./PlacePage";
import { PlacesPage } from "./PlacesPage";
import { placePaths } from "./paths";

export { notMountedWords } from "./words";

export const items = [
  { title: "Places", path: () => placePaths.places.path() },
  { title: "Addresses", path: () => placePaths.addresses.path() },
  { title: "Ownership & Tenure", path: () => placePaths.ownership.path() },
  { title: "Land Use", path: () => placePaths.landUse.path() },
];

export const routes = () => (
  <>
    <Route path={placePaths.places.pattern} element={<PlacesPage />} />
    <Route path={placePaths.place.pattern} element={<PlacePage />} />
    <Route path={placePaths.addresses.pattern} element={<AddressesPage />} />
    <Route path={placePaths.ownership.pattern} element={<OwnershipPage />} />
    <Route path={placePaths.holding.pattern} element={<HoldingPage />} />
    <Route path={placePaths.landUse.pattern} element={<LandUsePage />} />
  </>
);
