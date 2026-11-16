import { screen } from "../../../screen";

export const servicesPaths = {
  permits: screen("/menu/services/permits"),
  licences: screen("/menu/services/licences"),
  fees: screen("/menu/services/fees"),
  catalogue: screen("/menu/services/catalogue"),
  application: screen("/menu/services/applications/:id"),
};
