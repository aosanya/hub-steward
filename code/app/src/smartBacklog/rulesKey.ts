import { markNames } from "../backlogs/marks";
import { FIELD_IDS, type Rule, type RuleSet } from "./types";

const token = (text: string) => text.trim().toLowerCase().replace(/ /g, "_");

const span = (value: string) => {
  const [amount = "", unit = ""] = value.trim().toLowerCase().split(/\s+/);
  const count = Number(amount);
  const base = unit.replace(/s$/, "");
  return `${count} ${base}${count === 1 ? "" : "s"}`;
};

const valueOf = (field: string, value: string) => {
  if (field === "waits_on") return "";
  if (field === "mark") return markNames.find((mark) => mark.toLowerCase() === value.trim().toLowerCase()) ?? "Blocked";
  if (field === "last_changed") return span(value);
  return value.trim().toLowerCase();
};

const normalRule = (rule: Rule): Rule => ({ field: token(rule.field) as Rule["field"], operator: token(rule.operator) as Rule["operator"], value: valueOf(token(rule.field), rule.value) });

const rank = (field: string) => {
  const at = (FIELD_IDS as readonly string[]).indexOf(field);
  return at < 0 ? FIELD_IDS.length : at;
};

const before = (a: Rule, b: Rule) => rank(a.field) - rank(b.field) || (a.operator < b.operator ? -1 : a.operator > b.operator ? 1 : 0) || (a.value < b.value ? -1 : a.value > b.value ? 1 : 0);

export const rulesKey = (set: RuleSet): string => {
  const seen = new Set<string>();
  const rules = set.rules
    .map(normalRule)
    .filter((rule) => {
      const key = JSON.stringify(rule);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort(before);
  return JSON.stringify({ match: token(set.match) || "all", rules });
};

export const sameRules = (a: RuleSet, b: RuleSet): boolean => rulesKey(a) === rulesKey(b);
