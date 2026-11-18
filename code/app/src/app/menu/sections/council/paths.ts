import { screen } from "../../../screen";

export const councilPaths = {
  committees: screen("/menu/council/committees"),
  meetings: screen("/menu/council/meetings"),
  agendas: screen("/menu/council/agendas"),
  resolutions: screen("/menu/council/resolutions"),
  bylaws: screen("/menu/council/bylaws"),
  edit: screen("/menu/council/:kind/:id/edit"),
};
