import { agencyReads, type PageChat } from "./types";

export const publishChat: PageChat = {
  reads: [
    ...agencyReads,
    "agency_list_issues",
    "agency_list_publications",
    "agency_get_publication",
    "agency_get_draft",
    "agency_list_goals",
    "agency_get_goal",
    "agency_list_objectives",
    "agency_get_objective",
    "agency_list_measures",
    "agency_list_roles",
    "agency_list_workflows",
    "agency_list_workflow_objectives",
    "agency_list_scenarios",
  ],
  writes: [],
  suggests: [],
};
