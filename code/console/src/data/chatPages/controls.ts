import { agencyReads, type PageChat } from "./types";

const writes = ["agency_create_control", "agency_update_control", "agency_attach_control", "agency_detach_control"];

export const controlsChat: PageChat = {
  reads: [...agencyReads, "agency_list_controls", "agency_list_control_attachments", "agency_list_risks", "agency_list_unguarded_parts"],
  writes,
  suggests: [...writes, "agency_delete_control"],
};
