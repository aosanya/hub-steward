import { rest } from "../wakala/rest";

export type MyGroup = { id: string; name: string; roles: string[]; tags?: string[] };

export type GroupChoice = { groups: MyGroup[]; assumedId: string };

const texts = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

const groupOf = (row: any): MyGroup | null => {
  if (typeof row?.id !== "string" || row.id === "") return null;
  const group: MyGroup = { id: row.id, name: typeof row.name === "string" ? row.name : row.id, roles: texts(row.roles) };
  return Array.isArray(row.tags) ? { ...group, tags: texts(row.tags) } : group;
};

const groupPath = (hubId: string, leaf: string) => `/instances/${encodeURIComponent(hubId)}/${leaf}`;

export const listMyGroups = async (hubId: string): Promise<GroupChoice> => {
  const reply = await rest("GET", groupPath(hubId, "my-groups"));
  if (!reply.ok) throw new Error(`my-groups: ${reply.status}`);
  const rows: unknown[] = Array.isArray(reply.data?.groups) ? reply.data.groups : [];
  const assumed = reply.data?.assumed_group_id;
  return {
    groups: rows.flatMap((row) => groupOf(row) ?? []),
    assumedId: typeof assumed === "string" ? assumed : "",
  };
};

export const assumeGroup = async (hubId: string, groupId: string): Promise<void> => {
  const reply = await rest("PUT", groupPath(hubId, "my-group"), { group_id: groupId });
  if (!reply.ok) throw new Error(`my-group: ${reply.status}`);
};

export const rolesOf = (group: MyGroup) => group.roles.join(" · ");
