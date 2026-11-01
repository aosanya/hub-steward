import type { ActorDraft, GroupChoice, RoleChoice } from "../../data/scenario";

type Named = { name: string; roleName: string };

export const namesForRole = (
  role: string,
  roles: RoleChoice[],
  builtIn: Named[],
  actors: ActorDraft[],
  groups: GroupChoice[] = [],
): string[] => {
  const roleIds = roles
    .filter((choice) => choice.name === role)
    .map((choice) => choice.id);
  if (roleIds.length === 0 && groups.some((group) => group.name === role))
    return groups.map((group) => group.name);
  const names = [
    ...builtIn
      .filter((actor) => actor.roleName === role)
      .map((actor) => actor.name),
    ...actors
      .filter((actor) => roleIds.includes(actor.roleId))
      .map((actor) => actor.name),
  ].filter(Boolean);
  return names.length > 0 ? names : [role];
};
