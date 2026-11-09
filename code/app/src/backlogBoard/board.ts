import type { Issue } from "../backlogs/api";

export type Column = { step: string; issues: Issue[] };

export const unplacedStep = "Unplaced";

export const columnsOf = (steps: string[], issues: Issue[]): Column[] => {
  const columns = steps.map((step) => ({ step, issues: issues.filter((issue) => issue.step === step) }));
  const unplaced = issues.filter((issue) => !steps.includes(issue.step));
  return unplaced.length > 0 ? [...columns, { step: unplacedStep, issues: unplaced }] : columns;
};
