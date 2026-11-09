import type { Issue } from "../backlogs/api";

export type Column = { step: string; issues: Issue[] };

export const tagsOf = (issue: Issue) => [issue.mark, issue.repo, ...issue.topics].filter((tag) => tag !== "");

export const visibleIssues = (issues: Issue[], chosen: string[]) => issues.filter((issue) => chosen.every((tag) => tagsOf(issue).includes(tag)));

export const columnsOf = (steps: string[], issues: Issue[]): Column[] =>
  steps.map((step, index) => ({
    step,
    issues: issues.filter((issue) => (steps.includes(issue.step) ? issue.step === step : index === 0)),
  }));

export const toneOf = (tag: string) => (tag === "Ready" ? "success" : tag === "Blocked" ? "danger" : undefined);
