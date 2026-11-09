import type { Issue } from "../backlogs/api";

export type Column = { step: string; issues: Issue[] };

export const unplacedStep = "Unplaced";

const stepOf = (steps: string[], issue: Issue) => (issue.step === "" ? steps[0] : issue.step);

export const columnsOf = (steps: string[], issues: Issue[]): Column[] => {
  const columns = steps.map((step) => ({ step, issues: issues.filter((issue) => stepOf(steps, issue) === step) }));
  const unplaced = issues.filter((issue) => !steps.includes(stepOf(steps, issue)));
  return unplaced.length > 0 ? [...columns, { step: unplacedStep, issues: unplaced }] : columns;
};
