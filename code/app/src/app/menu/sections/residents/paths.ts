import { screen } from "../../../screen";

export const residentPaths = {
  people: screen("/menu/residents/people"),
  households: screen("/menu/residents/households"),
  household: screen("/menu/residents/households/:id"),
  registrations: screen("/menu/residents/registrations"),
  groups: screen("/menu/residents/groups"),
  group: screen("/menu/residents/groups/:id"),
  communications: screen("/menu/residents/communications"),
};
