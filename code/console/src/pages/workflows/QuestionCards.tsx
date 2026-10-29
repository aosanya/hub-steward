import { useState } from "react";
import { emptyQuestion, hasOptions, type AnswerType, type Choice, type QuestionDraft } from "../../data/pages/workflowDesign";
import { useI18n } from "../../i18n";
import { Button, Card, Labelled, TextareaControl, Toggle } from "../../ui";
import { PickLabelled, TextLabelled, moved, replaced, without } from "./editParts";

type QuestionProps = {
  id: string;
  number: number;
  count: number;
  question: QuestionDraft;
  lists: Choice[];
  answerTypes: AnswerType[];
  fixedText: boolean;
  onChange: (next: QuestionDraft) => void;
  onMove: (by: number) => void;
  onRemove: () => void;
};

function QuestionCard({ id, number, count, question, lists, answerTypes, fixedText, onChange, onMove, onRemove }: QuestionProps) {
  const { t } = useI18n();
  const [asking, setAsking] = useState(false);
  const [open, setOpen] = useState(question.prompt === "");
  const set = (change: Partial<QuestionDraft>) => onChange({ ...question, ...change });
  const typed = question.optionsFrom === "";
  return (
    <Card
      tight
      className="wf-question"
      open={open}
      onToggle={() => setOpen((now) => !now)}
      title={
        <>
          <span className="term">{`${t("workflows.question")} ${number}:`}</span> {question.prompt}
        </>
      }
      actions={
        <>
          <Button kind="quiet" size="xs" disabled={number === 1} onClick={() => onMove(-1)}>
            {t("workflows.up")}
          </Button>
          <Button kind="quiet" size="xs" disabled={number === count} onClick={() => onMove(1)}>
            {t("workflows.down")}
          </Button>
        </>
      }
    >
      <TextLabelled id={id + "-prompt"} label={t("workflows.question")} value={question.prompt} onChange={(prompt) => set({ prompt })} />
      {question.helper !== "" || asking ? (
        <TextLabelled id={id + "-helper"} label={t("workflows.explanation")} value={question.helper} onChange={(helper) => set({ helper })} />
      ) : (
        <Button kind="quiet" size="xs" onClick={() => setAsking(true)}>
          {t("workflows.addExplanation")}
        </Button>
      )}
      <PickLabelled
        id={id + "-type"}
        label={t("workflows.type")}
        value={question.answerType}
        options={answerTypes.map((type) => ({ value: type, label: t("workflows.type." + type) }))}
        onChange={(answerType) => set({ answerType })}
      />
      {hasOptions(question.answerType) ? (
        <>
          <PickLabelled
            id={id + "-from"}
            label={t("workflows.picksFrom")}
            value={question.optionsFrom}
            options={[{ value: "", label: t("workflows.typedList") }, ...lists]}
            onChange={(optionsFrom) => set({ optionsFrom })}
          />
          {typed ? (
            <Labelled id={id + "-options"} label={t("workflows.options")} required={false}>
              <TextareaControl
                id={id + "-options"}
                label={t("workflows.options")}
                value={question.options.join("\n")}
                onChange={(text) => set({ options: text.split("\n") })}
              />
            </Labelled>
          ) : null}
        </>
      ) : null}
      {fixedText ? <TextLabelled id={id + "-fixed"} label={t("workflows.fixedText")} value={question.fixed} onChange={(fixed) => set({ fixed })} /> : null}
      <Toggle label={t("required")} on={question.required} onChange={(required) => set({ required })} />
      <Button kind="quiet" size="xs" onClick={onRemove}>
        {t("workflows.remove")}
      </Button>
    </Card>
  );
}

type CardsProps = { id: string; questions: QuestionDraft[]; lists: Choice[]; answerTypes: AnswerType[]; fixedText?: boolean; onChange: (next: QuestionDraft[]) => void };

export function QuestionCards({ id, questions, lists, answerTypes, fixedText = false, onChange }: CardsProps) {
  const { t } = useI18n();
  return (
    <>
      <div className="wf-questions">
        {questions.map((question, index) => (
          <QuestionCard
            key={index}
            id={`${id}-q${index}`}
            number={index + 1}
            count={questions.length}
            question={question}
            lists={lists}
            answerTypes={answerTypes}
            fixedText={fixedText}
            onChange={(next) => onChange(replaced(questions, index, next))}
            onMove={(by) => onChange(moved(questions, index, by))}
            onRemove={() => onChange(without(questions, index))}
          />
        ))}
      </div>
      <div>
        <Button kind="quiet" size="sm" onClick={() => onChange([...questions, emptyQuestion()])}>
          {t("workflows.addQuestion")}
        </Button>
      </div>
    </>
  );
}
