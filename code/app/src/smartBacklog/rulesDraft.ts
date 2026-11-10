import { blankRule, fieldSpec, ruleComplete } from "./fields";
import type { FieldChoices, FieldId, Match, OperatorId, Rule, RuleSet } from "./types";

export type Draft = { name: string; match: Match; rules: Rule[] };

export const emptyDraft = (): Draft => ({ name: "", match: "all", rules: [] });

export const addRule = (draft: Draft, field: FieldId, choices: FieldChoices): Draft => ({ ...draft, rules: [...draft.rules, blankRule(field, choices)] });

export const removeRule = (draft: Draft, index: number): Draft => ({ ...draft, rules: draft.rules.filter((_, at) => at !== index) });

const replaceRule = (draft: Draft, index: number, rule: Rule): Draft => ({ ...draft, rules: draft.rules.map((was, at) => (at === index ? rule : was)) });

export const changeField = (draft: Draft, index: number, field: FieldId, choices: FieldChoices): Draft =>
  draft.rules[index].field === field ? draft : replaceRule(draft, index, blankRule(field, choices));

export const changeOperator = (draft: Draft, index: number, operator: OperatorId): Draft => replaceRule(draft, index, { ...draft.rules[index], operator });

export const changeValue = (draft: Draft, index: number, value: string): Draft => replaceRule(draft, index, { ...draft.rules[index], value });

export const draftProblem = (draft: Draft): string => {
  if (draft.name.trim() === "") return "Give the smart backlog a name.";
  if (draft.rules.length === 0) return "Add at least one rule.";
  const unfinished = draft.rules.find((rule) => !ruleComplete(rule));
  return unfinished ? `Finish the ${fieldSpec(unfinished.field).label} rule.` : "";
};

export const toRuleSet = (draft: Draft): RuleSet => ({ match: draft.match, rules: draft.rules.map((rule) => ({ ...rule, value: fieldSpec(rule.field).value === "none" ? "" : rule.value.trim() })) });

export const countWords = (count: number): string => `${count} ${count === 1 ? "issue matches" : "issues match"} now`;
