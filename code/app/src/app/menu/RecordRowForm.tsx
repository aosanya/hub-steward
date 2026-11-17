import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../shared/ui/Button";
import { ChoiceGroup, ChoiceRow } from "../../shared/ui/ChoiceRow";
import { Field } from "../../shared/ui/Field";
import { LoadFailed } from "../../shared/ui/LoadState";
import { callTool } from "../../shared/wakala/mcp";
import { Shell } from "../Shell";
import { refusalWords } from "./MenuEditForm";

const addLiveRecordRowTool = "agency_add_live_record_row";

export type RecordFormField = { prompt: string; required: boolean; options?: string[] };

type Props = {
  title: string;
  recordCode: string;
  fields: RecordFormField[];
  back: { to: string; label: string };
};

const optionalWords = (field: RecordFormField) => (field.required ? field.prompt : `${field.prompt} (optional)`);

const answersOf = (fields: RecordFormField[], values: Record<string, string>) =>
  Object.fromEntries(fields.map((field) => [field.prompt, (values[field.prompt] ?? "").trim()]).filter(([, answer]) => answer !== ""));

export function RecordRowForm({ title, recordCode, fields, back }: Props) {
  const navigate = useNavigate();
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [refused, setRefused] = useState("");
  const answers = answersOf(fields, values);
  const complete = fields.every((field) => !field.required || field.prompt in answers);
  const set = (prompt: string, value: string) => setValues((was) => ({ ...was, [prompt]: value }));
  const save = async () => {
    setSaving(true);
    setRefused("");
    try {
      await callTool("", addLiveRecordRowTool, { record_code: recordCode, answers });
      navigate(back.to);
    } catch (error) {
      setRefused(refusalWords(error));
      setSaving(false);
    }
  };
  return (
    <Shell title={title} titleUnder backLabel={back.label} onBack={() => navigate(back.to)} tabless>
      {fields.map((field) =>
        field.options ? (
          <ChoiceGroup key={field.prompt} label={optionalWords(field)}>
            {field.options.map((option) => (
              <ChoiceRow key={option} type="radio" name={field.prompt} label={option} checked={values[field.prompt] === option} onChange={() => set(field.prompt, option)} />
            ))}
          </ChoiceGroup>
        ) : (
          <Field key={field.prompt} label={optionalWords(field)} value={values[field.prompt] ?? ""} onChange={(event) => set(field.prompt, event.target.value)} />
        ),
      )}
      {refused ? <LoadFailed words={refused} /> : null}
      <Button kind="primary" disabled={saving || !complete} onClick={save}>Save</Button>
    </Shell>
  );
}
