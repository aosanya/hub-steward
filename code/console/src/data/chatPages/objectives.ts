import { agencyReads, type PageChat } from "./types";

const writes = ["agency_create_objective", "agency_update_objective", "agency_link_workflow_objective", "agency_set_measure"];

export const objectivesChat: PageChat = {
  reads: [
    ...agencyReads,
    "agency_list_objectives",
    "agency_get_objective",
    "agency_list_goals",
    "agency_list_roles",
    "agency_list_workflow_objectives",
    "agency_list_role_assignments",
    "agency_list_role_assignments_for_work_item",
    "agency_list_measures",
    "agency_list_workflows",
    "agency_list_work_items",
    "agency_list_modules",
    "agency_list_values",
    "agency_list_rules",
  ],
  writes,
  suggests: [...writes, "agency_delete_objective", "agency_delete_workflow_objective"],
};
