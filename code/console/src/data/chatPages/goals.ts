import { agencyReads, type PageChat } from "./types";

const writes = ["agency_update_goal", "agency_create_objective", "agency_update_objective", "agency_link_workflow_objective"];

export const goalsChat: PageChat = {
  reads: [
    ...agencyReads,
    "agency_list_goals",
    "agency_get_goal",
    "agency_list_objectives",
    "agency_get_objective",
    "agency_list_roles",
    "agency_list_workflow_objectives",
    "agency_list_role_assignments",
    "agency_list_measures",
  ],
  writes,
  suggests: [...writes, "agency_create_goal", "agency_delete_goal", "agency_delete_objective", "agency_delete_workflow_objective"],
};
