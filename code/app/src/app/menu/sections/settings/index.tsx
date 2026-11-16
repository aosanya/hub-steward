import { Route } from "react-router-dom";
import { AgencyProfile } from "./AgencyProfile";
import { BoundariesAndAreas } from "./BoundariesAndAreas";
import { Integrations } from "./Integrations";
import { settingsPaths } from "./paths";
import { UsersAndRoles } from "./UsersAndRoles";
import type { MenuItem } from "../../sections";

export const items: MenuItem[] = [
  { title: "Agency Profile", path: () => settingsPaths.agencyProfile.path() },
  { title: "Users & Roles", path: () => settingsPaths.usersAndRoles.path() },
  { title: "Boundaries & Areas", path: () => settingsPaths.boundariesAndAreas.path() },
  { title: "Integrations", path: () => settingsPaths.integrations.path() },
];

export const routes = () => (
  <>
    <Route path={settingsPaths.agencyProfile.pattern} element={<AgencyProfile />} />
    <Route path={settingsPaths.usersAndRoles.pattern} element={<UsersAndRoles />} />
    <Route path={settingsPaths.boundariesAndAreas.pattern} element={<BoundariesAndAreas />} />
    <Route path={settingsPaths.integrations.pattern} element={<Integrations />} />
  </>
);
