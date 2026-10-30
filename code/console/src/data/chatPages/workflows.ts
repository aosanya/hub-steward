import { agencyReads, type PageChat } from "./types";

export const workflowsChat: PageChat = {
  reads: [
    ...agencyReads,
    "agency_list_workflows",
    "agency_get_workflow",
    "agency_list_default_workflows",
    "agency_list_work_items",
    "agency_get_work_item",
    "agency_list_records",
    "agency_get_record",
    "agency_list_record_rows",
    "agency_list_scenarios",
    "agency_list_roles",
    "agency_get_role",
    "agency_list_objectives",
    "agency_list_workflow_objectives",
    "agency_list_role_assignments_for_work_item",
    "agency_list_pickers",
    "taskmanager_workflow_run_list_under_way",
    "taskmanager_workflow_run_list_closed",
  ],
  writes: [],
  suggests: ["agency_create_workflow", "agency_update_workflow", "agency_delete_workflow", "agency_create_work_item", "agency_update_work_item", "agency_delete_work_item", "agency_set_raci", "agency_link_workflow_objective", "agency_delete_workflow_objective", "taskmanager_workflow_run_stop"],
};
