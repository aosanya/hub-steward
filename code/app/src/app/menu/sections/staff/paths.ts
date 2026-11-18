import { screen } from "../../../screen";

export const staffPaths = {
  people: screen("/menu/staff/people"),
  personEdit: screen("/menu/staff/people/:id/edit"),
  departments: screen("/menu/staff/departments"),
  departmentNew: screen("/menu/staff/departments/new"),
  departmentEdit: screen("/menu/staff/departments/:id/edit"),
  crews: screen("/menu/staff/crews"),
  crewNew: screen("/menu/staff/crews/new"),
  crewEdit: screen("/menu/staff/crews/:id/edit"),
  roles: screen("/menu/staff/roles"),
  roleLimits: screen("/menu/staff/roles/:id/limits"),
  rolePermissions: screen("/menu/staff/roles/:id/permissions"),
};
