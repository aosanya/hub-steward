export const ownerRole = "owner";

export const staffRole = "agent";

export const isStaff = (role: string): boolean => role === staffRole;

export const consentPermission = "consent.publish";

export const holdsOnlyPermissions = (role: string, permissions: readonly string[] = []): boolean =>
  role !== ownerRole && !isStaff(role) && permissions.length > 0;
