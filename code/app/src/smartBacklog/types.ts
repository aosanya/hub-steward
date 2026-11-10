export const FIELD_IDS = ["tag", "mark", "backlog", "step", "priority", "title", "description", "waits_on", "last_changed"] as const;
export type FieldId = (typeof FIELD_IDS)[number];

export type OperatorId = "has" | "not_has" | "is" | "is_not" | "contains" | "not_contains" | "has_something" | "has_nothing" | "in_last" | "not_in_last";

export type Match = "all" | "any";

export type Rule = { field: FieldId; operator: OperatorId; value: string };

export type RuleSet = { match: Match; rules: Rule[] };

export type ChoiceFieldId = "tag" | "mark" | "backlog" | "step" | "priority";

export type FieldChoices = Record<ChoiceFieldId, string[]>;

export type CountMatches = (set: RuleSet) => Promise<number>;

export type CreateSmartBacklog = (name: string, set: RuleSet) => Promise<void>;
