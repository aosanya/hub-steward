import type { Rule } from "./types";

const wordsOf = (query: string) => query.toLowerCase().split(/\s+/).filter((word) => word !== "");

export const matchesRule = (rule: Rule, query: string) => {
  const text = [rule.code, rule.title, rule.body, ...rule.tags].join(" ").toLowerCase();
  return wordsOf(query).every((word) => text.includes(word));
};

export const narrowedRules = (rules: Rule[], query: string) => rules.filter((rule) => matchesRule(rule, query));
