import type { SegmentedItem } from "../ui/Segmented";
import type { AccessReading, AccessRow, AgencyGroup, ChoiceLevel } from "./types";

export const levelItems: SegmentedItem<ChoiceLevel>[] = [
  { id: "none", label: "No access" },
  { id: "see", label: "Can see" },
  { id: "move", label: "Can move" },
];

export const levelWords = (level: ChoiceLevel) => levelItems.find((item) => item.id === level)?.label ?? "";

const nameOf = (groups: AgencyGroup[], groupId: string) => groups.find((group) => group.id === groupId)?.name ?? groupId;

export const rowsOf = (reading: AccessReading, groups: AgencyGroup[]): AccessRow[] => {
  const owner: AccessRow[] = reading.ownerGroup === "" ? [] : [{ groupId: reading.ownerGroup, name: nameOf(groups, reading.ownerGroup), level: "move", fixed: true }];
  const others = reading.grants
    .filter((grant) => grant.groupId !== reading.ownerGroup)
    .map((grant): AccessRow => ({ groupId: grant.groupId, name: nameOf(groups, grant.groupId), level: grant.level, fixed: false }));
  return [...owner, ...others];
};

export const groupsWithoutAccess = (groups: AgencyGroup[], rows: AccessRow[]) => groups.filter((group) => !rows.some((row) => row.groupId === group.id));

export const withLevel = (rows: AccessRow[], groupId: string, level: "see" | "move") =>
  rows.map((row) => (row.groupId === groupId && !row.fixed ? { ...row, level } : row));

export const withGroup = (rows: AccessRow[], group: AgencyGroup): AccessRow[] => [...rows, { groupId: group.id, name: group.name, level: "see", fixed: false }];

export const withoutGroup = (rows: AccessRow[], groupId: string) => rows.filter((row) => row.groupId !== groupId || row.fixed);
