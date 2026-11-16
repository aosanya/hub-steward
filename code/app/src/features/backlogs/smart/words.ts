import { fieldSpec, operatorLabel } from "./fields";
import type { Match, Rule } from "./types";

export const ruleWords = (rule: Rule): string => [fieldSpec(rule.field).label, operatorLabel(rule), rule.value].filter((part) => part !== "").join(" ");

export const matchWords = (match: Match): string => `Matches ${match} of these rules`;

export const moreWords = (hidden: number): string => `+${hidden} more`;

export const rulesSheetTitle = "Rules";

export const deletedWords = (name: string) => `Deleted ${name}`;
