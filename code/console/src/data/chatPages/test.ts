import { agencyReads, type PageChat } from "./types";

export const testChat: PageChat = {
  reads: [
    ...agencyReads,
    "agency_list_scenarios",
    "agency_get_scenario",
    "agency_list_test_runs",
    "agency_get_test_run",
    "agency_list_workflows",
    "agency_get_workflow",
    "agency_list_roles",
    "agency_get_role",
    "agency_list_pickers",
    "agency_list_records",
    "agency_list_work_items",
  ],
  writes: [],
  suggests: ["agency_create_scenario", "agency_update_scenario", "agency_delete_scenario", "agency_add_scenario_actor", "agency_remove_scenario_actor"],
};
