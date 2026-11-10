import { fieldSpec, operatorLabel } from "./fields";
import type { Rule, RuleSet } from "./types";

const ruleWords = (rule: Rule): string => [fieldSpec(rule.field).label, operatorLabel(rule), rule.value].filter((part) => part !== "").join(" ");

export const rulesWords = (set: RuleSet): string => set.rules.map(ruleWords).join(set.match === "any" ? " or " : " · ");

export const deletedWords = (name: string) => `Deleted ${name}`;
