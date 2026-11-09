export type AccessLevel = "see" | "move";

export type ChoiceLevel = AccessLevel | "none";

export type AccessRow = { groupId: string; name: string; level: AccessLevel; fixed: boolean; roleName: string; roleTooSmall: boolean };

export type AgencyGroup = { id: string; name: string; hierarchyId: string };

export type Grant = { groupId: string; level: AccessLevel; roleTooSmall: boolean; roles: string[] };

export type AccessReading = { ownerGroup: string; grants: Grant[] };

export type BacklogAccessClient = {
  read: (backlogId: string) => Promise<AccessReading>;
  groups: () => Promise<AgencyGroup[]>;
  set: (backlogId: string, groupId: string, level: AccessLevel) => Promise<void>;
  remove: (backlogId: string, groupId: string) => Promise<void>;
  setOwnerGroup: (groupId: string) => Promise<void>;
};

export class AccessRefused extends Error {}

export const refusalWords = (error: unknown, fallback: string) => (error instanceof AccessRefused && error.message !== "" ? error.message : fallback);
