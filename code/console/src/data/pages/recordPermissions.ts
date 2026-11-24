import { callTool } from "../../wakala/mcp";
import { draftScope } from "../draft";
import { itemsOf, textOf } from "./groups";
import { permissionsOf, roleOf } from "./roles";

export const recordPermissionActions = ["add", "edit", "delete", "view"] as const;

export type RecordPermissionAction = (typeof recordPermissionActions)[number];

export type PermissionRecord = { code: string; name: string; itemName: string };

export type RecordPermissionSet = { records: PermissionRecord[]; held: string[] };

export const recordPermissionCode = (recordCode: string, action: RecordPermissionAction): string => `record.${recordCode}.${action}`;

export const loadRecordPermissions = async (hubId: string, roleId: string): Promise<RecordPermissionSet> => {
  const [records, role] = await Promise.all([
    draftScope(hubId).then((scope) => callTool<unknown>(hubId, "agency_list_records", scope)),
    callTool<unknown>(hubId, "agency_get_role", { role_id: roleId }),
  ]);
  return {
    records: itemsOf(records)
      .map((record) => ({ code: textOf(record, "code"), name: textOf(record, "name"), itemName: textOf(record, "item_name") }))
      .filter((record) => record.code !== ""),
    held: permissionsOf(roleOf(role)),
  };
};

export const permissionChange = (set: RecordPermissionSet, ticked: ReadonlySet<string>): { add: string[]; remove: string[] } => {
  const held = new Set(set.held);
  const codes = set.records.flatMap((record) => recordPermissionActions.map((action) => recordPermissionCode(record.code, action)));
  return { add: codes.filter((code) => ticked.has(code) && !held.has(code)), remove: codes.filter((code) => !ticked.has(code) && held.has(code)) };
};
