import type { Rule, RuleFile, RuleIssue, RuleKind } from "./types";

const text = (value: unknown) => (typeof value === "string" ? value : "");

const kindOf = (value: unknown): RuleKind => (value === "decision" || value === "question" ? value : "rule");

const textsOf = (value: unknown): string[] => (Array.isArray(value) ? value.filter((one): one is string => typeof one === "string" && one !== "") : []);

export const ruleOf = (raw: any): Rule => ({
  id: text(raw?.id),
  kind: kindOf(raw?.kind),
  code: text(raw?.code),
  title: text(raw?.title),
  body: text(raw?.body),
  status: text(raw?.status),
  tags: textsOf(raw?.tags),
  supersedes: text(raw?.supersedes),
  supersededBy: text(raw?.superseded_by),
  decidedBy: text(raw?.decided_by),
  decidedAt: text(raw?.decided_at),
  priority: text(raw?.priority),
  answeredBy: text(raw?.answered_by),
  createdAt: text(raw?.created_at),
});

export const issueOf = (raw: any): RuleIssue => ({
  id: text(raw?.issue_id),
  code: text(raw?.issue_code),
  title: text(raw?.title),
  relation: text(raw?.relation),
});

export const fileOf = (raw: any): RuleFile => ({
  id: text(raw?.id),
  repo: text(raw?.repo),
  path: text(raw?.path),
  line: typeof raw?.line === "number" ? raw.line : 0,
  note: text(raw?.note),
  addedBy: text(raw?.added_by),
  missing: raw?.missing === true,
});
