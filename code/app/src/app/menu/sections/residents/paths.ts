import { screen } from "../../../screen";

export const residentPaths = {
  people: screen("/menu/residents/people"),
  person: screen("/menu/residents/people/:id"),
  households: screen("/menu/residents/households"),
  registrations: screen("/menu/residents/registrations"),
  groups: screen("/menu/residents/groups"),
  communications: screen("/menu/residents/communications"),
};
