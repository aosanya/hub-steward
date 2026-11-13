import type { EarlierStep } from "./api";

export type Edits = Record<string, { text: string; struck: boolean }>;

export const editKey = (stepIndex: number, answerIndex: number) => `${stepIndex}:${answerIndex}`;

const amendmentOf = (original: string, edit: Edits[string]): string | undefined => {
  if (edit.struck) return `Struck out "${original}"`;
  const now = edit.text.trim();
  return now === original.trim() ? undefined : `Changed from "${original}" to "${now}"`;
};

export const amendmentsOf = (earlier: EarlierStep[], edits: Edits): Record<string, string> => {
  const found: Record<string, string> = {};
  earlier.forEach((step, stepIndex) =>
    step.answers.forEach((answer, answerIndex) => {
      const edit = edits[editKey(stepIndex, answerIndex)];
      const amendment = edit && amendmentOf(answer.answer, edit);
      if (amendment) found[`Changed: ${step.stepTitle}: ${answer.prompt}`] = amendment;
    }),
  );
  return found;
};
