import { screen } from "../../../screen";

export const settingsPaths = {
  agencyProfile: screen("/menu/settings/agency-profile"),
  usersAndRoles: screen("/menu/settings/users-and-roles"),
  boundariesAndAreas: screen("/menu/settings/boundaries-and-areas"),
  boundaryEdit: screen("/menu/settings/boundaries-and-areas/:id/edit"),
  integrations: screen("/menu/settings/integrations"),
  aiAgents: screen("/menu/settings/ai-agents"),
  aiAgentEdit: screen("/menu/settings/ai-agents/:id/edit"),
  auditLog: screen("/menu/settings/audit-log"),
  registerDetails: screen("/menu/settings/details-of-a-record"),
  lateRules: screen("/menu/settings/late-rules"),
  lateRulesEdit: screen("/menu/settings/late-rules/edit"),
};
