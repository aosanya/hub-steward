import type { BacklogSummary } from "./summaries";

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export const issuesWords = (n: number) => count(n, "issue", "issues");

export const stepsWords = (n: number) => count(n, "step", "steps");

export const backlogLine = (backlog: BacklogSummary) => `${issuesWords(backlog.issues)} in ${stepsWords(backlog.steps)}`;
