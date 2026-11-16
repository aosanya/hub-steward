export const FIELD_IDS = ["tag", "mark", "backlog", "step", "priority", "title", "description", "waits_on", "last_changed"] as const;
export type FieldId = (typeof FIELD_IDS)[number];

export type OperatorId = "has" | "does_not_have" | "is" | "is_not" | "contains" | "does_not_contain" | "has_something" | "has_nothing" | "in_the_last" | "not_in_the_last";

export type Match = "all" | "any";

export type Rule = { field: FieldId; operator: OperatorId; value: string };

export type RuleSet = { match: Match; rules: Rule[] };

export type ChoiceFieldId = "tag" | "mark" | "backlog" | "step" | "priority";

export type FieldChoices = Record<ChoiceFieldId, string[]>;

export type CountMatches = (set: RuleSet) => Promise<number>;

export type CreateSmartBacklog = (name: string, set: RuleSet) => Promise<void>;

export type SmartBacklog = { id: string; name: string; set: RuleSet; issues: number };

export class DuplicateRules extends Error {
  constructor(
    public readonly existingId: string,
    public readonly existingName: string,
  ) {
    super(`${existingName} already has these rules.`);
  }
}

export type SmartBacklogClient = {
  choices: () => Promise<FieldChoices>;
  count: CountMatches;
  create: (name: string, set: RuleSet) => Promise<string>;
  read: (backlogId: string) => Promise<SmartBacklog>;
  update: (backlogId: string, name: string, set: RuleSet) => Promise<void>;
  mayManage: () => Promise<boolean>;
  remove: (backlogId: string) => Promise<void>;
};
