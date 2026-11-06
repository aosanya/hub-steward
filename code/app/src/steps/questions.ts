import type { FormQuestion } from "../forms/api";
import type { StartStep } from "../coordinator/start/api";
import { filled, given, isChoice, isFile, type Draft } from "../pages/forms/answers";

export const formQuestionsOf = (step: Pick<StartStep, "questions">): FormQuestion[] =>
  step.questions.map((q, index) => ({
    id: String(index),
    prompt: q.prompt,
    answer_type: q.answerType,
    required: q.required === true,
    helper: q.helper || undefined,
    options: (q.options ?? []).map((label) => ({ id: label, label })),
  }));

export const unsendable = (q: FormQuestion) => isFile(q);

const answerText = (q: FormQuestion, draft: Draft): string => {
  const value = given(q, draft);
  return isChoice(q) ? value.options.join(", ") : value.text.trim();
};

export const answersOf = (questions: FormQuestion[], draft: Draft): Record<string, string> =>
  Object.fromEntries(questions.filter((q) => !unsendable(q) && filled(q, draft)).map((q) => [q.prompt, answerText(q, draft)]));
