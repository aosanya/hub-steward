import { reportRefused } from "../../shared/wakala/mcp";
import { wakalaFetch } from "../entry/api";

export type SeatedGroup = { id: string; name: string; roles: string[] };

export type MyGroupsReading = { groups: SeatedGroup[]; assumedId: string };

export type AssumedGroupsClient = {
  read(hubId: string): Promise<MyGroupsReading>;
  assume(hubId: string, groupId: string): Promise<void>;
};

const hubPath = (hubId: string, route: string) => `/instances/${encodeURIComponent(hubId)}/${route}`;

const seatedGroupOf = (raw: any): SeatedGroup => ({
  id: String(raw?.id ?? ""),
  name: String(raw?.name ?? ""),
  roles: Array.isArray(raw?.roles) ? raw.roles.map(String) : [],
});

export const httpAssumedGroupsClient: AssumedGroupsClient = {
  async read(hubId) {
    const res = await wakalaFetch(hubPath(hubId, "my-groups"), { method: "GET" });
    if (res.status === 401) reportRefused();
    if (!res.ok) throw new Error(`your groups answered ${res.status}`);
    const body = await res.json();
    const groups: any[] = Array.isArray(body?.groups) ? body.groups : [];
    return { groups: groups.map(seatedGroupOf).filter((group) => group.id !== ""), assumedId: String(body?.assumed_group_id ?? "") };
  },
  async assume(hubId, groupId) {
    const res = await wakalaFetch(hubPath(hubId, "my-group"), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ group_id: groupId }),
    });
    if (!res.ok) throw new Error(`assuming the group answered ${res.status}`);
  },
};

let current: AssumedGroupsClient = httpAssumedGroupsClient;

export const assumedGroupsClient = (): AssumedGroupsClient => current;

export const provideAssumedGroupsClient = (client: AssumedGroupsClient) => {
  current = client;
};
