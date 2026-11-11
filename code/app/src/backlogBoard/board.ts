import type { Issue } from "../backlogs/api";

export type Column = { step: string; issues: Issue[] };

export const unplacedStep = "Unplaced";

export const columnsOf = (steps: string[], issues: Issue[]): Column[] => {
  const columns = steps.map((step) => ({ step, issues: issues.filter((issue) => issue.step === step) }));
  const unplaced = issues.filter((issue) => !steps.includes(issue.step));
  return unplaced.length > 0 ? [...columns, { step: unplacedStep, issues: unplaced }] : columns;
};

export const stepsOfIssues = (backlogs: { id: string; steps: string[]; kind?: "smart" }[], issues: Issue[]): string[] => {
  const held = new Set(issues.map((issue) => issue.backlogId));
  const steps = backlogs.filter((backlog) => backlog.kind !== "smart" && held.has(backlog.id)).flatMap((backlog) => backlog.steps);
  return [...new Set(steps)];
};
