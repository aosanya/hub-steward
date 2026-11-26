import { useState } from "react";
import type { Choice, Question, QuestionsClient } from "./types";

export const closedWith = (choice: Choice, question: Question) => ("option" in choice ? question.options[choice.option]?.text ?? "" : choice.other);

export function useAnswering(client: QuestionsClient, after: () => void = () => undefined) {
  const [closed, setClosed] = useState<Record<string, string>>({});
  const answerOf = (question: Question) => async (choice: Choice) => {
    await client.answer(question.code, choice);
    setClosed((now) => ({ ...now, [question.code]: closedWith(choice, question) }));
    after();
  };
  const shown = (question: Question): Question => ({ ...question, answer: closed[question.code] ?? question.answer });
  return { answerOf, shown };
}
