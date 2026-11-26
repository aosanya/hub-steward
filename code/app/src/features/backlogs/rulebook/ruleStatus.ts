import type { ChipTone } from "../../../shared/ui/Chip";
import type { Rule } from "./types";
import type { RulebookWords } from "./words";

export const statusLabel = (rule: Rule, words: RulebookWords): string => {
  if (rule.status === "superseded" && rule.supersededBy !== "") return words.supersededByWords(rule.supersededBy);
  return (words.statusWords[rule.kind] as Record<string, string>)[rule.status] ?? rule.status;
};

export const statusTone = (status: string): ChipTone | undefined => {
  if (status === "in_force" || status === "decided") return "accent";
  return status === "open" ? "waiting" : undefined;
};

export const priorityTone = (priority: string): ChipTone | undefined => {
  if (priority === "P1") return "danger";
  return priority === "P2" ? "accent" : undefined;
};
