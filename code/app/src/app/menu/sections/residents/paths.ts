import { screen } from "../../../screen";

export const residentPaths = {
  search: screen("/menu/residents/search"),
  people: screen("/menu/residents/people"),
  personEdit: screen("/menu/residents/people/:id/edit"),
  personSection: screen("/menu/residents/people/:id/:section"),
  households: screen("/menu/residents/households"),
  householdEdit: screen("/menu/residents/households/:id/edit"),
  registrations: screen("/menu/residents/registrations"),
  groups: screen("/menu/residents/groups"),
  groupEdit: screen("/menu/residents/groups/:id/edit"),
  communications: screen("/menu/residents/communications"),
  businesses: screen("/menu/residents/businesses"),
  informalTraders: screen("/menu/residents/informal-traders"),
};
