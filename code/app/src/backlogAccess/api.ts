import { callTool, McpError } from "../wakala/mcp";
import { AccessRefused, type AccessReading, type AgencyGroup, type BacklogAccessClient, type Grant } from "./types";

export const accessTools = {
  list: "taskmanager_backlog_access_list",
  give: "taskmanager_backlog_access_give",
  take: "taskmanager_backlog_access_take",
  groups: "actor_list_groups",
};

const text = (value: unknown) => (typeof value === "string" ? value : "");

const itemsOf = (reply: any): any[] => (Array.isArray(reply) ? reply : Array.isArray(reply?.items) ? reply.items : []);

export const grantOf = (raw: any): Grant => ({ groupId: text(raw?.group_id), level: raw?.level === "move" ? "move" : "see" });

export const readingOf = (raw: any): AccessReading => ({
  ownerGroup: text(raw?.owner_group),
  grants: (Array.isArray(raw?.groups) ? raw.groups : []).map(grantOf).filter((grant: Grant) => grant.groupId !== ""),
});

export const groupOf = (raw: any): AgencyGroup => ({ id: text(raw?.id ?? raw?.group_id), name: text(raw?.name) });

const refusalText = (error: unknown) => {
  const message = error instanceof McpError ? error.message : "";
  const colon = message.indexOf(": ");
  return colon >= 0 ? message.slice(colon + 2) : message;
};

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
};
