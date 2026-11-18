import { screen } from "../../../screen";

export const placePaths = {
  places: screen("/menu/properties/places"),
  place: screen("/menu/properties/places/:placeId"),
  addresses: screen("/menu/properties/addresses"),
  ownership: screen("/menu/properties/ownership-tenure"),
  holdingNew: screen("/menu/properties/ownership-tenure/new"),
  holding: screen("/menu/properties/ownership-tenure/:tenureId"),
  landUse: screen("/menu/properties/land-use"),
};
