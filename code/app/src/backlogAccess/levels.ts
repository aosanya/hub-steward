import type { SegmentedItem } from "../ui/Segmented";
import type { AccessReading, AccessRow, AgencyGroup, ChoiceLevel } from "./types";

export const levelItems: SegmentedItem<ChoiceLevel>[] = [
  { id: "none", label: "No access" },
  { id: "see", label: "Can see" },
  { id: "move", label: "Can move" },
];

export const levelWords = (level: ChoiceLevel) => levelItems.find((item) => item.id === level)?.label ?? "";

export const goneGroupWords = "A group that no longer exists";

const nameOf = (groups: AgencyGroup[], groupId: string) => groups.find((group) => group.id === groupId)?.name ?? goneGroupWords;

export const noRoleWords = "no role yet";

const roleNames: Record<string, string> = { backlog_member: "Backlog member", backlog_worker: "Backlog worker" };

export const roleWords = (codes: string[]) => codes.map((code) => roleNames[code] ?? code).join(", ");

export const rowsOf = (reading: AccessReading, groups: AgencyGroup[]): AccessRow[] => {
  const owner: AccessRow[] =
    reading.ownerGroup === ""
      ? []
      : [{ groupId: reading.ownerGroup, name: nameOf(groups, reading.ownerGroup), level: "move", fixed: true, roleName: "", roleTooSmall: false }];
  const others = reading.grants
    .filter((grant) => grant.groupId !== reading.ownerGroup)
    .map((grant): AccessRow => ({ groupId: grant.groupId, name: nameOf(groups, grant.groupId), level: grant.level, fixed: false, roleName: roleWords(grant.roles), roleTooSmall: grant.roleTooSmall }));
  return [...owner, ...others];
};

export const groupsOfOwnerHierarchy = (groups: AgencyGroup[], ownerGroup: string) => {
  const hierarchyId = groups.find((group) => group.id === ownerGroup)?.hierarchyId ?? "";
  return hierarchyId === "" ? groups : groups.filter((group) => group.hierarchyId === hierarchyId);
};

export const groupsWithoutAccess = (groups: AgencyGroup[], rows: AccessRow[]) => groups.filter((group) => !rows.some((row) => row.groupId === group.id));

export const withLevel = (rows: AccessRow[], groupId: string, level: "see" | "move") =>
  rows.map((row) => (row.groupId === groupId && !row.fixed ? { ...row, level } : row));

export const withGroup = (rows: AccessRow[], group: AgencyGroup): AccessRow[] => [...rows, { groupId: group.id, name: group.name, level: "see", fixed: false, roleName: "", roleTooSmall: false }];

export const withoutGroup = (rows: AccessRow[], groupId: string) => rows.filter((row) => row.groupId !== groupId || row.fixed);
