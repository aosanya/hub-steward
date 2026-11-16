import { Route } from "react-router-dom";
import { CrewsScreen } from "./CrewsScreen";
import { DepartmentsScreen } from "./DepartmentsScreen";
import { RolesPermissionsScreen } from "./RolesPermissionsScreen";
import { StaffScreen } from "./StaffScreen";
import { staffPaths } from "./paths";

export { CrewsScreen, DepartmentsScreen, RolesPermissionsScreen, StaffScreen };

export const items = [
  { title: "Staff", path: () => staffPaths.people.path() },
  { title: "Departments", path: () => staffPaths.departments.path() },
  { title: "Crews", path: () => staffPaths.crews.path() },
  { title: "Roles & Permissions", path: () => staffPaths.roles.path() },
];

export const routes = () => (
  <>
    <Route path={staffPaths.people.pattern} element={<StaffScreen />} />
    <Route path={staffPaths.departments.pattern} element={<DepartmentsScreen />} />
    <Route path={staffPaths.crews.pattern} element={<CrewsScreen />} />
    <Route path={staffPaths.roles.pattern} element={<RolesPermissionsScreen />} />
  </>
);
