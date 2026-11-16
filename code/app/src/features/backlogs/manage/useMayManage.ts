import { useLoad } from "../../../features/forms/useLoad";
import { openAgencyId } from "../../../shared/wakala/openAgency";
import type { BacklogManageClient } from "./types";

export const useMayManage = (client: BacklogManageClient) => useLoad(() => client.mayManage(), `may-manage-backlogs:${openAgencyId()}`);
