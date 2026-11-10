import { callTool } from "../wakala/mcp";
import { backlogTools, refusalText } from "../backlogManage/api";
import { AccessRefused, type AccessReading, type AgencyGroup, type BacklogAccessClient, type Grant } from "./types";

export const accessTools = {
  list: "taskmanager_backlog_access_list",
  give: "taskmanager_backlog_access_give",
  take: "taskmanager_backlog_access_take",
  ownerGroup: "taskmanager_backlog_set_owner_group",
  groups: "actor_list_groups",
};

const text = (value: unknown) => (typeof value === "string" ? value : "");

const itemsOf = (reply: any): any[] => (Array.isArray(reply) ? reply : Array.isArray(reply?.items) ? reply.items : []);

export const grantOf = (raw: any): Grant => ({
  groupId: text(raw?.group_id),
  level: raw?.level === "edit" ? "edit" : raw?.level === "move" ? "move" : "see",
  roleTooSmall: raw?.role_too_small === true,
  noRole: raw?.no_role === true,
  roles: (Array.isArray(raw?.roles) ? raw.roles : []).filter((code: unknown) => typeof code === "string" && code !== ""),
});

export const readingOf = (raw: any): AccessReading => ({
  ownerGroup: text(raw?.owner_group),
  grants: (Array.isArray(raw?.groups) ? raw.groups : []).map(grantOf).filter((grant: Grant) => grant.groupId !== ""),
});

export const groupOf = (raw: any): AgencyGroup => ({ id: text(raw?.id ?? raw?.group_id), name: text(raw?.name), hierarchyId: text(raw?.hierarchy_id) });

const refused = async <T>(call: Promise<T>): Promise<T> => {
  try {
    return await call;
  } catch (error) {
    throw new AccessRefused(refusalText(error));
  }
};

export const mcpBacklogAccessClient: BacklogAccessClient = {
  async read(backlogId) {
    return readingOf(await callTool("", accessTools.list, { backlogID: backlogId }));
  },
  async groups() {
    return itemsOf(await callTool("", accessTools.groups, {})).map(groupOf).filter((group) => group.id !== "" && group.name !== "");
  },
  async set(backlogId, groupId, level) {
    await refused(callTool("", accessTools.give, { backlogID: backlogId, groupID: groupId, level }));
  },
  async remove(backlogId, groupId) {
    await refused(callTool("", accessTools.take, { backlogID: backlogId, groupID: groupId }));
  },
  async isSmart(backlogId) {
    return itemsOf(await callTool("", backlogTools.list, {})).some((raw) => text(raw?.id) === backlogId && raw?.kind === "smart");
  },
  async setOwnerGroup(groupId) {
    await refused(callTool("", accessTools.ownerGroup, { group_id: groupId }));
  },
};
