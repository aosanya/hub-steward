import { permissionNames } from "../permissionNames";
import { loadGenerated, type GeneratedRecord } from "./generatedWorkflows";

export type RecordPermissionAction = "add" | "edit" | "delete" | "view";

export type HeldPermission = { code: string; name: string; action: RecordPermissionAction | null; item: string };

const recordActions: RecordPermissionAction[] = ["add", "edit", "delete", "view"];

const recordPrefix = "record.";

const isRecordCode = (code: string): boolean => code.startsWith(recordPrefix);

const splitRecordCode = (code: string): { record: string; action: RecordPermissionAction } | null => {
  const [, record, action, ...rest] = code.split(".");
  const known = recordActions.find((one) => one === action);
  return record && known && rest.length === 0 ? { record, action: known } : null;
};

const recordsOf = async (hubId: string): Promise<GeneratedRecord[]> => {
  try {
    return (await loadGenerated(hubId)).records;
  } catch {
    return [];
  }
};

const itemOf = (record: GeneratedRecord | undefined): string => record?.itemName || record?.name || "";

export const heldPermissions = async (hubId: string, codes: string[]): Promise<HeldPermission[]> => {
  if (codes.length === 0) return [];
  const [names, records] = await Promise.all([permissionNames(hubId), codes.some(isRecordCode) ? recordsOf(hubId) : Promise.resolve([])]);
  return codes.map((code) => {
    const split = isRecordCode(code) ? splitRecordCode(code) : null;
    const item = split ? itemOf(records.find((record) => record.code === split.record)) : "";
    return { code, name: names.get(code) ?? "", action: split && item ? split.action : null, item };
  });
};
