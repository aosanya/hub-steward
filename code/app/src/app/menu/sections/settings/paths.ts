import { screen } from "../../../screen";

export const settingsPaths = {
  agencyProfile: screen("/menu/settings/agency-profile"),
  usersAndRoles: screen("/menu/settings/users-and-roles"),
  boundariesAndAreas: screen("/menu/settings/boundaries-and-areas"),
  boundaryNew: screen("/menu/settings/boundaries-and-areas/new"),
  boundaryEdit: screen("/menu/settings/boundaries-and-areas/:id/edit"),
  registerDetails: screen("/menu/settings/details-of-a-record"),
  registerDetailsEdit: screen("/menu/settings/details-of-a-record/:id/edit"),
  lateRules: screen("/menu/settings/late-rules"),
  lateRulesEdit: screen("/menu/settings/late-rules/edit"),
  paymentSettings: screen("/menu/settings/payments"),
};
