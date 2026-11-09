import { useLoad } from "../forms/useLoad";
import { openAgencyId } from "../agency/open";
import type { BacklogManageClient } from "./types";

export const useMayManage = (client: BacklogManageClient) => useLoad(() => client.mayManage(), `may-manage-backlogs:${openAgencyId()}`);
