import { useLoad } from "../../forms/useLoad";
import { useLanguage } from "../../../shared/language/language";
import { Card } from "../../../shared/ui/Card";
import { openAgencyId } from "../../../shared/wakala/openAgency";
import { useAnswering } from "./answering";
import { QuestionBlock } from "./QuestionBlock";
import type { QuestionsClient } from "./types";

export function IssueQuestions({ issueId, client }: { issueId: string; client: QuestionsClient }) {
  const { words } = useLanguage();
  const { answerOf, shown } = useAnswering(client);
  const found = useLoad(async () => ({ questions: await client.forIssue(issueId), standing: await client.standing() }), `questions:${openAgencyId()}:${issueId}`);
  if (found.state === "loading") return null;
  if (found.state === "error") return <p className="sub">{words.questionsLoadFailed}</p>;
  const { questions, standing } = found.data;
  if (questions.length === 0) return null;
  return (
    <Card title={<>{words.questionsTitle}<span className="meta qcount">{questions.length}</span></>} collapsible>
      {questions.map((question) => (
        <QuestionBlock key={question.code} question={shown(question)} canAnswer={standing.holds(question.targetRole)} onAnswer={answerOf(question)} />
      ))}
    </Card>
  );
}
