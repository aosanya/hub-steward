import type { FormQuestion } from "../forms/api";
import type { StartStep } from "../market";
import { filled, given, isChoice, isFile, type Draft } from "../forms/answers";
import { isTimeRange, rangeWords, splitRange } from "../forms/timeRange";

export const formQuestionsOf = (step: Pick<StartStep, "questions">): FormQuestion[] =>
  step.questions.map((q, index) => ({
    id: String(index),
    prompt: q.prompt,
    answer_type: q.answerType,
    required: q.required === true,
    helper: q.helper || undefined,
    options: (q.options ?? []).map((label) => ({ id: label, label })),
    allow_free_text: q.allowFreeText ? true : undefined,
  }));

export const unsendable = (q: FormQuestion) => isFile(q);

const answerText = (q: FormQuestion, draft: Draft): string => {
  const value = given(q, draft);
  if (isTimeRange(q.answer_type)) return rangeWords(splitRange(value.text).from, splitRange(value.text).to);
  return isChoice(q) ? value.options.join(", ") : value.text.trim();
};

export const answersOf = (questions: FormQuestion[], draft: Draft): Record<string, string> =>
  Object.fromEntries(questions.filter((q) => !unsendable(q) && filled(q, draft)).map((q) => [q.prompt, answerText(q, draft)]));
