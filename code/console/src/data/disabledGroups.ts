import { reasonOf, rest } from "../wakala/rest";

const instancePath = (hubId: string, leaf: string) => `/instances/${encodeURIComponent(hubId)}/${leaf}`;

export const listDisabledGroups = async (hubId: string): Promise<string[]> => {
  const reply = await rest("GET", instancePath(hubId, "disabled-groups"));
  if (!reply.ok) throw new Error(reasonOf(reply, `disabled-groups: ${reply.status}`));
  const ids: unknown[] = Array.isArray(reply.data?.group_ids) ? reply.data.group_ids : [];
  return ids.filter((id): id is string => typeof id === "string");
};

export const setGroupDisabled = async (hubId: string, groupId: string, disabled: boolean): Promise<void> => {
  const leaf = `groups/${encodeURIComponent(groupId)}/${disabled ? "disable" : "enable"}`;
  const reply = await rest("POST", instancePath(hubId, leaf));
  if (!reply.ok) throw new Error(reasonOf(reply, `${leaf}: ${reply.status}`));
};
