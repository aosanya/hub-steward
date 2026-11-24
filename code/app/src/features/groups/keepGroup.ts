import { rememberAssumedGroup } from "../../shared/wakala/assumedGroup";
import { forgetReads } from "../../shared/wakala/mcp";
import { assumedGroupsClient, type SeatedGroup } from "./assumedApi";

export const holdGroup = (agencyId: string, group: SeatedGroup, count: number) => {
  rememberAssumedGroup({ agencyId, id: group.id, name: group.name, count });
  forgetReads();
};

export const keepGroup = async (agencyId: string, group: SeatedGroup, count: number) => {
  await assumedGroupsClient().assume(agencyId, group.id);
  holdGroup(agencyId, group, count);
};
