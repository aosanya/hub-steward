import type { Rule } from "../rulebook";

const codeNumber = (code: string) => Number(/(\d+)\D*$/.exec(code)?.[1] ?? Number.MAX_SAFE_INTEGER);

const timeOf = (rule: Rule) => {
  const time = Date.parse(rule.createdAt);
  return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
};

const oldestFirst = (a: Rule, b: Rule) => {
  const byTime = timeOf(a) === timeOf(b) ? 0 : timeOf(a) < timeOf(b) ? -1 : 1;
  return byTime !== 0 ? byTime : codeNumber(a.code) - codeNumber(b.code) || a.code.localeCompare(b.code);
};

export const inBook = <T extends Rule>(rules: T[]): T[] => rules.filter((rule) => rule.kind === "rule" && rule.status === "in_force").sort(oldestFirst);
