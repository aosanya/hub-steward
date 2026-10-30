import { agencyReads, type PageChat } from "./types";

const writes = ["agency_create_risk", "agency_update_risk", "agency_create_risk_pathway", "agency_update_risk_pathway"];

export const risksChat: PageChat = {
  reads: [
    ...agencyReads,
    "agency_list_risks",
    "agency_get_risk",
    "agency_list_risk_pathways",
    "agency_list_goals",
    "agency_list_objectives",
    "agency_list_roles",
    "agency_list_workflows",
  ],
  writes,
  suggests: [...writes, "agency_delete_risk", "agency_delete_risk_pathway"],
};
