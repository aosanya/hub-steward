import { useLanguage } from "../../../shared/language/language";
import { Chip } from "../../../shared/ui/Chip";
import { priorityTone } from "../rulebook/ruleStatus";
import { QuestionOptions } from "./QuestionOptions";
import type { Choice, Question } from "./types";

type Props = { question: Question; canAnswer: boolean; onAnswer: (choice: Choice) => Promise<void> };

export function QuestionBlock({ question, canAnswer, onAnswer }: Props) {
  const { words } = useLanguage();
  return (
    <div className="question-block">
      <div className="question-head">
        <span className="issue-code">{question.code}</span>
        {question.priority !== "" ? <Chip tone={priorityTone(question.priority)}>{question.priority}</Chip> : null}
        {question.targetRole !== "" ? <span className="meta question-for">{words.questionForRole.replace("{role}", question.targetRole)}</span> : null}
      </div>
      <p className="question-text">{question.title}</p>
      <QuestionOptions question={question} canAnswer={canAnswer} onAnswer={onAnswer} />
    </div>
  );
}
