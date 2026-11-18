import { screen } from "../../../screen";

export const councilPaths = {
  committees: screen("/menu/council/committees"),
  meetings: screen("/menu/council/meetings"),
  agendas: screen("/menu/council/agendas"),
  resolutions: screen("/menu/council/resolutions"),
  bylaws: screen("/menu/council/bylaws"),
  meetingNew: screen("/menu/council/meetings/new"),
  resolutionNew: screen("/menu/council/resolutions/new"),
  bylawNew: screen("/menu/council/bylaws/new"),
  committeeNew: screen("/menu/council/committees/new"),
  edit: screen("/menu/council/:kind/:id/edit"),
  declarations: screen("/menu/council/declarations"),
};
