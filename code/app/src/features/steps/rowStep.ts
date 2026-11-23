import type { FormQuestion } from "../forms/api";
import { isChoice, isFile, type Draft } from "../forms/answers";
import type { StartQuestion } from "../market";
import { formQuestionsOf, unsendable } from "./questions";
import type { MemberStep } from "./api";

export type StepOrigin = { from?: { path: string; title: string }; landing?: string };

export const openedRow = "{row}";

export const isRowStep = (step: Pick<MemberStep, "rowAction">) => step.rowAction === "edit" || step.rowAction === "delete";

export const originOf = (state: unknown): StepOrigin => {
  const given = state as { from?: { path?: unknown; title?: unknown }; landing?: unknown } | null;
  const from = typeof given?.from?.path === "string" && typeof given.from.title === "string" ? { path: given.from.path, title: given.from.title } : undefined;
  return { ...(from ? { from } : {}), ...(typeof given?.landing === "string" ? { landing: given.landing } : {}) };
};

export const landingOf = (origin: StepOrigin, rowId: string | undefined): string | undefined => {
  if (!origin.landing) return origin.from?.path;
  if (!origin.landing.includes(openedRow)) return origin.landing;
  return rowId ? origin.landing.replace(openedRow, encodeURIComponent(rowId)) : origin.from?.path;
};

const chosenOf = (answer: string) => (answer.includes(";") ? answer.split(";") : answer.split(", ")).map((one) => one.trim()).filter((one) => one !== "");

const draftOf = (question: FormQuestion, answer: string) => {
  if (answer === "") return undefined;
  if (isFile(question)) return undefined;
  if (isChoice(question)) {
    const ids = question.options.map((option) => option.id);
    return { text: "", options: chosenOf(answer).filter((one) => ids.includes(one)) };
  }
  if (question.answer_type === "yes_no") return { text: answer.toLowerCase(), options: [] };
  return { text: answer, options: [] };
};

export const prefillOf = (questions: Pick<StartQuestion, "prompt" | "answerType" | "options" | "required">[], answers: Record<string, string>): Draft => {
  const asked = formQuestionsOf({ questions: questions.map((question) => ({ ...question, helper: "" })) });
  return Object.fromEntries(asked.flatMap((question) => {
    const found = draftOf(question, answers[question.prompt] ?? "");
    return found ? [[question.id, found]] : [];
  }));
};

export const keptAnswersOf = (questions: Pick<StartQuestion, "prompt" | "answerType" | "options" | "required">[], answers: Record<string, string>): Record<string, string> =>
  Object.fromEntries(
    formQuestionsOf({ questions: questions.map((question) => ({ ...question, helper: "" })) })
      .filter(unsendable)
      .map((question) => [question.prompt, answers[question.prompt] ?? ""])
      .filter(([, answer]) => answer !== ""),
  );
