import { callTool } from "../../shared/wakala/mcp";
import { openAgencyId } from "../../shared/wakala/openAgency";
import { useLoad } from "../forms/useLoad";

export type MyAccess = { owner: boolean; permissions: string[]; roles: string[] };

const rolesTool = "agency_get_my_roles";

const stringsOf = (value: unknown): string[] => (Array.isArray(value) ? value.filter((one): one is string => typeof one === "string") : []);

const roleCodesOf = (value: unknown): string[] =>
  (Array.isArray(value) ? value : []).map((role) => (typeof role?.code === "string" ? role.code : "")).filter((code) => code !== "");

export const readMyAccess = async (): Promise<MyAccess> => {
  const reply = await callTool("", rolesTool, {});
  return { owner: reply?.membership === "owner", permissions: stringsOf(reply?.permissions), roles: roleCodesOf(reply?.roles) };
};

export const holdsPermission = (access: MyAccess, permission: string) => access.owner || access.permissions.includes(permission);

export const useMyPermissions = (attempt = 0) => useLoad(readMyAccess, `my-access:${openAgencyId()}:${attempt}`);
