import type { PageChat } from "./types";

const writes = ["agency_set_module_enabled"];

export const modulesChat: PageChat = {
  reads: ["agency_get_agency", "agency_list_modules", "agency_list_workflows", "agency_list_work_items"],
  writes,
  suggests: writes,
};
