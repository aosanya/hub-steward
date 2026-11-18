import { screen } from "../../../screen";

export const residentPaths = {
  search: screen("/menu/residents/search"),
  people: screen("/menu/residents/people"),
  personSection: screen("/menu/residents/people/:id/:section"),
  households: screen("/menu/residents/households"),
  registrations: screen("/menu/residents/registrations"),
  groups: screen("/menu/residents/groups"),
  communications: screen("/menu/residents/communications"),
  businesses: screen("/menu/residents/businesses"),
  informalTraders: screen("/menu/residents/informal-traders"),
};
