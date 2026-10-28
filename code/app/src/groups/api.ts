import { callTool } from "../wakala/mcp";

export type JoinableGroup = {
  id: string;
  name: string;
  code: string;
  approvalNeeded: boolean;
};
export type MyGroup = { id: string; name: string };
export type JoinRequest = { groupId: string; state: string };

export const groupTools = {
  listJoinable: "actor_list_joinable_groups",
  findByCode: "actor_find_group_by_code",
  join: "actor_join_group",
  listMyRequests: "actor_list_my_join_requests",
  listMine: "actor_list_my_groups",
} as const;

export type GroupsClient = {
  listJoinableGroups(): Promise<JoinableGroup[]>;
  findGroupByCode(code: string): Promise<JoinableGroup | null>;
  joinGroup(groupId: string): Promise<JoinRequest>;
  listMyJoinRequests(): Promise<JoinRequest[]>;
  listMyGroups(): Promise<MyGroup[]>;
};

const groupOf = (raw: any): JoinableGroup => ({
  id: String(raw?.id ?? raw?.group_id ?? ""),
  name: String(raw?.name ?? ""),
  code: String(raw?.public_code ?? ""),
  approvalNeeded: raw?.join_mode !== "open",
});

const myGroupOf = (raw: any): MyGroup => ({
  id: String(raw?.id ?? ""),
  name: String(raw?.name ?? ""),
});

const requestOf = (raw: any, groupId = ""): JoinRequest => ({
  groupId: String(raw?.group_id ?? raw?.id ?? groupId),
  state: String(raw?.state ?? "pending"),
});

const itemsOf = (reply: any): any[] => (Array.isArray(reply?.items) ? reply.items : []);

export const mcpGroupsClient = (hubId = ""): GroupsClient => ({
  async listJoinableGroups() {
    return itemsOf(await callTool(hubId, groupTools.listJoinable)).map(groupOf);
  },
  async findGroupByCode(code) {
    const reply = await callTool<any>(hubId, groupTools.findByCode, { code });
    const found = reply?.group ?? reply?.items?.[0] ?? (reply?.id ? reply : null);
    return found ? groupOf(found) : null;
  },
  async joinGroup(groupId) {
    const reply = await callTool<any>(hubId, groupTools.join, { group_id: groupId });
    if (reply?.status === "joined" || reply?.status === "member") return { groupId, state: "joined" };
    return requestOf(reply?.request ?? reply, groupId);
  },
  async listMyJoinRequests() {
    return itemsOf(await callTool(hubId, groupTools.listMyRequests)).map((raw) => requestOf(raw));
  },
  async listMyGroups() {
    return itemsOf(await callTool(hubId, groupTools.listMine))
      .map(myGroupOf)
      .filter((group) => group.id !== "");
  },
});
