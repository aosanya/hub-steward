import type { ChipTone } from "../../../shared/ui/Chip";
import type { Rule } from "./types";
import { statusWords, supersededByWords } from "./words";

const wordsOf = (kind: Rule["kind"], status: string): string | undefined => (statusWords[kind] as Record<string, string>)[status];

export const statusLabel = (rule: Rule): string => {
  if (rule.status === "superseded" && rule.supersededBy !== "") return supersededByWords(rule.supersededBy);
  return wordsOf(rule.kind, rule.status) ?? rule.status;
};

export const statusTone = (status: string): ChipTone | undefined => {
  if (status === "in_force" || status === "decided") return "accent";
  return status === "open" ? "waiting" : undefined;
};

export const priorityTone = (priority: string): ChipTone | undefined => {
  if (priority === "P1") return "danger";
  return priority === "P2" ? "accent" : undefined;
};
