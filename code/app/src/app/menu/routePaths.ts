import { screen } from "../screen";

export const menuPaths = {
  menu: screen("/menu/:sectionId"),
  businessNew: screen("/menu/residents/businesses/new"),
  informalTraderNew: screen("/menu/residents/informal-traders/new"),
};
