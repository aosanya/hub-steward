import { screen } from "../../../screen";

export const issuePaths = {
  all: screen("/menu/issues/all"),
  assigned: screen("/menu/issues/assigned"),
  map: screen("/menu/issues/map"),
  serviceTypes: screen("/menu/issues/service-types"),
  issue: screen("/menu/issues/all/:id"),
};
