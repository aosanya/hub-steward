import { useRef, useState } from "react";
import { useLoad } from "../../forms/useLoad";
import { useLanguage } from "../../../shared/language/language";
import { Button } from "../../../shared/ui/Button";
import { Card } from "../../../shared/ui/Card";
import { openAgencyId } from "../../../shared/wakala/openAgency";
import { useAnswering } from "./answering";
import { AskQuestion } from "./AskQuestion";
import { QuestionBlock } from "./QuestionBlock";
import type { Question, QuestionsClient, Standing } from "./types";
import "./questions.css";

type Props = { issueId: string; client: QuestionsClient; tags?: string[] };
type Held = { questions: Question[]; standing: Standing };

export function IssueQuestions({ issueId, client, tags = [] }: Props) {
  const { words } = useLanguage();
  const { answerOf, shown } = useAnswering(client);
  const [asking, setAsking] = useState(false);
  const [version, setVersion] = useState(0);
  const last = useRef<Held | null>(null);
  const found = useLoad(async () => ({ questions: await client.forIssue(issueId), standing: await client.standing() }), `questions:${openAgencyId()}:${issueId}:${version}`);
  if (found.state === "ready") last.current = found.data;
  if (found.state === "error") return <p className="sub">{words.questionsLoadFailed}</p>;
  const held = last.current;
  if (held === null) return null;
  const { questions, standing } = held;
  const ask = client.ask ? (
    <Button disabled={!standing.canAsk} onClick={() => setAsking(true)}>{words.questionAsk}</Button>
  ) : null;
  return (
    <>
      <Card title={<>{words.questionsTitle}{questions.length > 0 ? <span className="meta qcount">{questions.length}</span> : null}</>} collapsible>
        {questions.length === 0 ? (
          <div className="qempty">
            <p className="meta">{words.questionsNone}</p>
            {ask}
          </div>
        ) : (
          <>
            {questions.map((question) => (
              <QuestionBlock key={question.code} question={shown(question)} canAnswer={standing.holds(question.targetRole)} roleName={standing.nameOf(question.targetRole)} onAnswer={answerOf(question)} />
            ))}
            {ask}
          </>
        )}
      </Card>
      {asking ? (
        <AskQuestion
          issueId={issueId}
          tags={tags}
          client={client}
          onClose={() => setAsking(false)}
          onAsked={() => {
            setAsking(false);
            setVersion((now) => now + 1);
          }}
        />
      ) : null}
    </>
  );
}
