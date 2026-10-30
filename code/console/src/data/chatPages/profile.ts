import { agencyReads, type PageChat } from "./types";

export const profileChat: PageChat = {
  reads: [
    ...agencyReads,
    "instance_",
    "agency_list_goals",
    "agency_list_objectives",
    "agency_list_roles",
    "agency_list_values",
    "agency_list_rules",
    "agency_list_workflows",
    "agency_list_modules",
    "agency_list_publications",
  ],
  writes: [],
  suggests: ["agency_update_agency"],
};
