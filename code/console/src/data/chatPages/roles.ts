import { agencyReads, type PageChat } from "./types";

const writes = ["agency_create_role", "agency_update_role"];

export const rolesChat: PageChat = {
  reads: [
    ...agencyReads,
    "agency_list_roles",
    "agency_get_role",
    "agency_get_role_brief",
    "agency_list_role_assignments",
    "agency_list_goals",
    "agency_list_objectives",
    "agency_list_rules",
    "agency_list_scenarios",
    "agency_list_permissions",
  ],
  writes,
  suggests: [...writes, "agency_delete_role"],
};
