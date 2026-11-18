import { Route } from "react-router-dom";
import { GroupEditScreen } from "../residents/GroupEditScreen";
import { PersonEditScreen } from "../residents/PersonEditScreen";
import { CrewsScreen } from "./CrewsScreen";
import { DepartmentsScreen } from "./DepartmentsScreen";
import { GroupNewScreen } from "./GroupNewScreen";
import { RoleLimitsEditScreen, RolePermissionsEditScreen } from "./RoleEditScreens";
import { RolesPermissionsScreen } from "./RolesPermissionsScreen";
import { StaffScreen } from "./StaffScreen";
import { staffPaths } from "./paths";

export { CrewsScreen, DepartmentsScreen, RoleLimitsEditScreen, RolePermissionsEditScreen, RolesPermissionsScreen, StaffScreen };

export const items = [
  { title: "Staff", path: () => staffPaths.people.path() },
  { title: "Departments", path: () => staffPaths.departments.path() },
  { title: "Crews", path: () => staffPaths.crews.path() },
  { title: "Roles & Permissions", path: () => staffPaths.roles.path() },
];

export const routes = () => (
  <>
    <Route path={staffPaths.people.pattern} element={<StaffScreen />} />
    <Route path={staffPaths.personEdit.pattern} element={<PersonEditScreen backTo={(id) => staffPaths.people.path({ person: id })} />} />
    <Route path={staffPaths.departments.pattern} element={<DepartmentsScreen />} />
    <Route path={staffPaths.departmentNew.pattern} element={<GroupNewScreen nodeType="Department" word="department" listPath={() => staffPaths.departments.path()} />} />
    <Route path={staffPaths.departmentEdit.pattern} element={<GroupEditScreen backTo={(id) => staffPaths.departments.path({ group: id })} />} />
    <Route path={staffPaths.crews.pattern} element={<CrewsScreen />} />
    <Route path={staffPaths.crewNew.pattern} element={<GroupNewScreen nodeType="Crew" word="crew" listPath={() => staffPaths.crews.path()} />} />
    <Route path={staffPaths.crewEdit.pattern} element={<GroupEditScreen backTo={(id) => staffPaths.crews.path({ group: id })} />} />
    <Route path={staffPaths.roles.pattern} element={<RolesPermissionsScreen />} />
    <Route path={staffPaths.roleLimits.pattern} element={<RoleLimitsEditScreen />} />
    <Route path={staffPaths.rolePermissions.pattern} element={<RolePermissionsEditScreen />} />
  </>
);
