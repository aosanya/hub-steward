import { useState } from "react";
import { useLanguage } from "../../../shared/language/language";
import { Button } from "../../../shared/ui/Button";
import { Chip } from "../../../shared/ui/Chip";
import { ListRow, Rows } from "../../../shared/ui/ListRow";
import { TextArea } from "../../../shared/ui/TextArea";
import type { Choice, Question } from "./types";
import "./questions.css";

type Props = { question: Question; canAnswer: boolean; roleName?: string; onAnswer: (choice: Choice) => Promise<void> };

export function QuestionOptions({ question, canAnswer, roleName = question.targetRole, onAnswer }: Props) {
  const { words } = useLanguage();
  const [typing, setTyping] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const send = (choice: Choice) => {
    setBusy(true);
    setFailed(false);
    onAnswer(choice).then(
      () => setBusy(false),
      () => {
        setBusy(false);
        setFailed(true);
      },
    );
  };
  if (question.answer !== "") {
    return <p className="question-answered">{words.questionAnswered.replace("{answer}", question.answer)}</p>;
  }
  const open = canAnswer && !busy;
  return (
    <div className="question-options">
      <Rows>
        {question.options.map((option, index) => (
          <ListRow
            key={option.text}
            title={option.text}
            meta={option.reason}
            end={option.recommended ? <Chip tone="accent">{words.questionRecommended}</Chip> : undefined}
            onClick={open ? () => send({ option: index }) : undefined}
          />
        ))}
        {canAnswer ? <ListRow title={words.questionOther} pressed={typing} onClick={() => setTyping(!typing)} /> : null}
      </Rows>
      {canAnswer && typing ? (
        <>
          <TextArea label={words.questionOtherLabel} value={typed} onChange={(event) => setTyped(event.target.value)} />
          <Button kind="primary" disabled={busy || typed.trim() === ""} onClick={() => send({ other: typed.trim() })}>
            {words.questionSendAnswer}
          </Button>
        </>
      ) : null}
      {failed ? <p className="sub" role="alert">{words.questionAnswerFailed}</p> : null}
      <p className="sub">{canAnswer ? words.questionClosesNote : words.questionReadOnly.replace("{role}", roleName)}</p>
    </div>
  );
}
