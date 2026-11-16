import { screen } from "../../../screen";

export const staffPaths = {
  people: screen("/menu/staff/people"),
  member: screen("/menu/staff/people/:id"),
  departments: screen("/menu/staff/departments"),
  crews: screen("/menu/staff/crews"),
  roles: screen("/menu/staff/roles"),
};
