import { screen } from "../../../screen";

export const servicesPaths = {
  applications: screen("/menu/services/applications"),
  permits: screen("/menu/services/permits"),
  licences: screen("/menu/services/licences"),
  fees: screen("/menu/services/fees"),
  catalogue: screen("/menu/services/catalogue"),
  catalogueNew: screen("/menu/services/catalogue/new"),
  catalogueEdit: screen("/menu/services/catalogue/:slug/edit"),
  application: screen("/menu/services/applications/:id"),
};
