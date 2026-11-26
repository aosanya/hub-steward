import { useState } from "react";
import { useLoad } from "../../forms/useLoad";
import { useLanguage } from "../../../shared/language/language";
import { Card } from "../../../shared/ui/Card";
import { openAgencyId } from "../../../shared/wakala/openAgency";
import { QuestionBlock } from "./QuestionBlock";
import type { Choice, Question, QuestionsClient } from "./types";

const closedWith = (choice: Choice, question: Question) => ("option" in choice ? question.options[choice.option]?.text ?? "" : choice.other);

export function IssueQuestions({ issueId, client }: { issueId: string; client: QuestionsClient }) {
  const { words } = useLanguage();
  const [closed, setClosed] = useState<Record<string, string>>({});
  const found = useLoad(async () => ({ questions: await client.forIssue(issueId), standing: await client.standing() }), `questions:${openAgencyId()}:${issueId}`);
  if (found.state === "loading") return null;
  if (found.state === "error") return <p className="sub">{words.questionsLoadFailed}</p>;
  const { questions, standing } = found.data;
  if (questions.length === 0) return null;
  return (
    <Card title={<>{words.questionsTitle}<span className="meta qcount">{questions.length}</span></>} collapsible>
      {questions.map((question) => (
        <QuestionBlock
          key={question.code}
          question={{ ...question, answer: closed[question.code] ?? question.answer }}
          canAnswer={standing.holds(question.targetRole)}
          onAnswer={async (choice) => {
            await client.answer(question.code, choice);
            setClosed((now) => ({ ...now, [question.code]: closedWith(choice, question) }));
          }}
        />
      ))}
    </Card>
  );
}
