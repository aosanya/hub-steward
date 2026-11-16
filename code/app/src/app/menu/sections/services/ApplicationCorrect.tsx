import { useState } from "react";
import { useMay } from "../../../../features/agency/useMay";
import { Button } from "../../../../shared/ui/Button";
import { Field } from "../../../../shared/ui/Field";
import { LoadFailed } from "../../../../shared/ui/LoadState";
import { callTool } from "../../../../shared/wakala/mcp";
import { refusalWords } from "../../MenuEditForm";

export const correctPermission = "application.correct";

export type SentAnswer = { id: string; questionId: string; prompt: string; valueKey: string; value: string };

const correctTool = "forms_submission_correct";

const wholeOrDecimal = /^-?\d+(\.\d+)?$/;

const sendable = (answer: SentAnswer, text: string) => ({
  question_id: answer.questionId,
  [answer.valueKey]: answer.valueKey === "value_number" && wholeOrDecimal.test(text.trim()) ? Number(text.trim()) : text,
});

const notNumber = (answer: SentAnswer, text: string) => answer.valueKey === "value_number" && !wholeOrDecimal.test(text.trim());

type Props = { formId: string; memberId: string; answers: SentAnswer[]; onSaved: () => void };

export function ApplicationCorrect({ formId, memberId, answers, onSaved }: Props) {
  const may = useMay(correctPermission);
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [refused, setRefused] = useState("");
  const editable = answers.filter((answer) => answer.valueKey !== "");
  if (!may || !memberId || editable.length === 0) return null;
  const changed = editable.filter((answer) => values[answer.id] !== answer.value);
  const invalid = changed.some((answer) => notNumber(answer, values[answer.id]));
  const open = () => {
    setValues(Object.fromEntries(editable.map((answer) => [answer.id, answer.value])));
    setRefused("");
    setEditing(true);
  };
  const save = async () => {
    setSaving(true);
    setRefused("");
    try {
      await callTool("", correctTool, { form_id: formId, member_id: memberId, answers: changed.map((answer) => sendable(answer, values[answer.id])) });
      setEditing(false);
      onSaved();
    } catch (error) {
      setRefused(refusalWords(error));
    } finally {
      setSaving(false);
    }
  };
  if (!editing) return <Button kind="quiet" onClick={open}>Edit</Button>;
  return (
    <>
      {editable.map((answer) => (
        <Field
          key={answer.id}
          label={answer.prompt}
          error={notNumber(answer, values[answer.id] ?? "") && values[answer.id] !== answer.value ? `${answer.prompt} must be a number` : undefined}
          value={values[answer.id] ?? ""}
          onChange={(event) => setValues((was) => ({ ...was, [answer.id]: event.target.value }))}
        />
      ))}
      <Button kind="primary" disabled={saving || changed.length === 0 || invalid} onClick={save}>Save</Button>
      <Button kind="quiet" disabled={saving} onClick={() => setEditing(false)}>Cancel</Button>
      {refused ? <LoadFailed words={refused} /> : null}
    </>
  );
}
