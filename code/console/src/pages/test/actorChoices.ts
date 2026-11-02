import type { ActorDraft, Choices, RoleChoice } from "../../data/scenario";

export const actorChoices = (
  choices: Choices,
  actors: ActorDraft[],
): RoleChoice[] => [
  ...choices.roles,
  ...choices.groups
    .filter((group) => actors.some((actor) => actor.roleId === group.id))
    .map(({ id, name }) => ({ id, name })),
];
