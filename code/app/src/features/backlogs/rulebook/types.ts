export type RuleKind = "rule" | "decision" | "question";

export type Rule = {
  id: string;
  kind: RuleKind;
  code: string;
  title: string;
  body: string;
  status: string;
  tags: string[];
  supersedes: string;
  supersededBy: string;
  decidedBy: string;
  decidedAt: string;
  priority: string;
  answeredBy: string;
  createdAt: string;
};

export type RuleRelation = "applies_to" | "decided_in" | "broken_by";

export type RuleIssue = { id: string; code: string; title: string; relation: string };

export type RuleFile = {
  id: string;
  repo: string;
  path: string;
  line: number;
  note: string;
  addedBy: string;
  missing: boolean;
};

export type Answer<T> =
  | { state: "ready"; data: T }
  | { state: "missing" }
  | { state: "forbidden" }
  | { state: "no_access" }
  | { state: "failed" };

export type ListOptions = { statuses?: string[]; tags?: string[] };

export type OpenedRule = {
  rule: Rule;
  issues: RuleIssue[];
  files: RuleFile[];
  produced: Rule[];
  settledIn: RuleIssue[];
  why?: Rule;
  answer?: Rule;
};

export type RulebookClient = {
  list(backlogId: string, kind: RuleKind, options?: ListOptions): Promise<Answer<Rule[]>>;
  read(code: string): Promise<Answer<Rule>>;
  issues(code: string): Promise<Answer<RuleIssue[]>>;
  files(code: string): Promise<Answer<RuleFile[]>>;
  produced(code: string): Promise<Answer<Rule[]>>;
  settledIn(code: string): Promise<Answer<RuleIssue[]>>;
  why(code: string): Promise<Answer<Rule | undefined>>;
  open(code: string): Promise<Answer<OpenedRule>>;
};
