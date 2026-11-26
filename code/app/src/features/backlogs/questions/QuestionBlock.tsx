import { Link } from "react-router-dom";
import { useLanguage } from "../../../shared/language/language";
import { Chip } from "../../../shared/ui/Chip";
import { priorityTone } from "../rulebook/ruleStatus";
import { QuestionOptions } from "./QuestionOptions";
import type { Choice, Question } from "./types";

type Props = { question: Question; canAnswer: boolean; roleName?: string; onAnswer: (choice: Choice) => Promise<void>; to?: string; state?: unknown };

const asksForAnswer = (question: Question) => question.answer !== "" || (question.status === "open" && question.options.length > 0);

export function QuestionBlock({ question, canAnswer, roleName = question.targetRole, onAnswer, to, state }: Props) {
  const { words } = useLanguage();
  return (
    <div className="question-block">
      <div className="question-head">
        <span className="issue-code">{question.code}</span>
        {question.priority !== "" ? <Chip tone={priorityTone(question.priority)}>{question.priority}</Chip> : null}
        {question.targetRole !== "" ? <span className="meta question-for">{words.questionForRole.replace("{role}", roleName)}</span> : null}
      </div>
      <p className="question-text">{to ? <Link to={to} state={state}>{question.title}</Link> : question.title}</p>
      {asksForAnswer(question) ? <QuestionOptions question={question} canAnswer={canAnswer} roleName={roleName} onAnswer={onAnswer} /> : null}
    </div>
  );
}
