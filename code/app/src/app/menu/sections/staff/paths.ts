import { screen } from "../../../screen";

export const staffPaths = {
  people: screen("/menu/staff/people"),
  personEdit: screen("/menu/staff/people/:id/edit"),
  departments: screen("/menu/staff/departments"),
  departmentEdit: screen("/menu/staff/departments/:id/edit"),
  crews: screen("/menu/staff/crews"),
  crewEdit: screen("/menu/staff/crews/:id/edit"),
  roles: screen("/menu/staff/roles"),
};
