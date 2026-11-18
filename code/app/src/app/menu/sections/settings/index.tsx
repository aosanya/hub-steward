import { Route } from "react-router-dom";
import { AgencyProfile } from "./AgencyProfile";
import { BoundariesAndAreas } from "./BoundariesAndAreas";
import { BoundaryEditScreen } from "./BoundaryEditScreen";
import { LateRules } from "./LateRules";
import { LateRulesEdit } from "./LateRulesEdit";
import { settingsPaths } from "./paths";
import { RegisterDetails } from "./RegisterDetails";
import { RegisterDetailsEdit } from "./RegisterDetailsEdit";
import { UsersAndRoles } from "./UsersAndRoles";
import type { MenuItem } from "../../sections";

export const items: MenuItem[] = [
  { title: "Agency Profile", path: () => settingsPaths.agencyProfile.path() },
  { title: "Users & Roles", path: () => settingsPaths.usersAndRoles.path() },
  { title: "Boundaries & Areas", path: () => settingsPaths.boundariesAndAreas.path() },
  { title: "Details of a record", path: () => settingsPaths.registerDetails.path() },
  { title: "Late rules", path: () => settingsPaths.lateRules.path() },
];

export const routes = () => (
  <>
    <Route path={settingsPaths.agencyProfile.pattern} element={<AgencyProfile />} />
    <Route path={settingsPaths.usersAndRoles.pattern} element={<UsersAndRoles />} />
    <Route path={settingsPaths.boundariesAndAreas.pattern} element={<BoundariesAndAreas />} />
    <Route path={settingsPaths.boundaryEdit.pattern} element={<BoundaryEditScreen />} />
    <Route path={settingsPaths.registerDetails.pattern} element={<RegisterDetails />} />
    <Route path={settingsPaths.registerDetailsEdit.pattern} element={<RegisterDetailsEdit />} />
    <Route path={settingsPaths.lateRules.pattern} element={<LateRules />} />
    <Route path={settingsPaths.lateRulesEdit.pattern} element={<LateRulesEdit />} />
  </>
);
