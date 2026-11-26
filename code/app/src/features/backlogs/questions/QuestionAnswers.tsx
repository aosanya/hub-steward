import type { ReactNode } from "react";
import { useLoad } from "../../forms/useLoad";
import { useLanguage } from "../../../shared/language/language";
import { Card } from "../../../shared/ui/Card";
import { openAgencyId } from "../../../shared/wakala/openAgency";
import { useAnswering } from "./answering";
import { QuestionOptions } from "./QuestionOptions";
import type { QuestionsClient } from "./types";

type Props = { code: string; client: QuestionsClient; onAnswered: () => void; fallback?: ReactNode };

export function QuestionAnswers({ code, client, onAnswered, fallback = null }: Props) {
  const { words } = useLanguage();
  const { answerOf, shown } = useAnswering(client, onAnswered);
  const found = useLoad(async () => ({ question: await client.read(code), standing: await client.standing() }), `question-answers:${openAgencyId()}:${code}`);
  if (found.state === "loading") return null;
  if (found.state === "error") return <>{fallback}</>;
  const { question, standing } = found.data;
  if (question.options.length === 0 && question.answer === "") return <>{fallback}</>;
  return (
    <Card title={words.questionAnswersTitle} collapsible>
      {question.targetRole !== "" ? <p className="meta question-for">{words.questionForRole.replace("{role}", question.targetRole)}</p> : null}
      <QuestionOptions question={shown(question)} canAnswer={standing.holds(question.targetRole)} onAnswer={answerOf(question)} />
    </Card>
  );
}
