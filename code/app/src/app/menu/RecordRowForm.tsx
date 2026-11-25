import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { itemsOf } from "../../features/backlogs";
import { Button } from "../../shared/ui/Button";
import { ChoiceGroup, ChoiceRow } from "../../shared/ui/ChoiceRow";
import { Field } from "../../shared/ui/Field";
import { LoadFailed } from "../../shared/ui/LoadState";
import { ReferencePicker } from "../../shared/ui/ReferencePicker";
import type { Choice } from "../../shared/ui/SearchSelect";
import { callTool } from "../../shared/wakala/mcp";
import { Shell } from "../Shell";
import { saveRegisterRow } from "./liveRecordRows";
import { loadAssetChoices, noAsset } from "./assetChoices";
import { loadReferenceChoices, type Reference } from "./referenceChoices";
import { refusalWords } from "./MenuEditForm";
import { personNameOf } from "./sections/residents/personName";

export type RecordFormField = { prompt: string; required: boolean; options?: string[]; people?: boolean; assets?: boolean; refers?: Reference; fixed?: boolean; kind?: "date" | "number" | "time"; multi?: boolean };

type Props = {
  title: string;
  recordCode: string;
  fields: RecordFormField[];
  back: { to: string; label: string; toSaved?: (id: string) => string };
  edit?: { rowId: string; saved: Record<string, string> };
  initial?: Record<string, string>;
  kept?: Record<string, string>;
};

const savedRowId = (reply: unknown) => {
  const id = (reply as { id?: unknown } | null)?.id;
  return typeof id === "string" ? id : "";
};

const optionalWords = (field: RecordFormField) => (field.required ? field.prompt : `${field.prompt} (optional)`);

const answersOf = (fields: RecordFormField[], values: Record<string, string>) =>
  Object.fromEntries(fields.map((field) => [field.prompt, (values[field.prompt] ?? "").trim()]).filter(([, answer]) => answer !== ""));

const joiner = "; ";

const chosenOf = (value: string | undefined) => (value ? value.split(joiner) : []);

const noOne: Choice = { value: "", label: "No one" };

export const loadPeople = async (): Promise<Choice[]> => {
  const people = itemsOf(await callTool("", "actor_list_actors")) as Record<string, unknown>[];
  return [noOne, ...people.map((person) => ({ value: String(person.id), label: personNameOf(person) }))];
};

export function RecordRowForm({ title, recordCode, fields, back, edit, initial, kept }: Props) {
  const navigate = useNavigate();
  const [values, setValues] = useState<Record<string, string>>(edit?.saved ?? initial ?? {});
  const [saving, setSaving] = useState(false);
  const [refused, setRefused] = useState("");
  const [people, setPeople] = useState<Choice[]>([noOne]);
  const [assets, setAssets] = useState<Choice[]>([noAsset]);
  const [referred, setReferred] = useState<Partial<Record<Reference, Choice[]>>>({});
  const referencesAsked = [...new Set(fields.flatMap((field) => (field.refers ? [field.refers] : [])))].join(",");
  const asksForPeople = fields.some((field) => field.people);
  const asksForAssets = fields.some((field) => field.assets);
  useEffect(() => {
    if (asksForPeople) loadPeople().then(setPeople, () => setPeople([noOne]));
  }, [asksForPeople]);
  useEffect(() => {
    if (asksForAssets) loadAssetChoices().then(setAssets, () => setAssets([noAsset]));
  }, [asksForAssets]);
  useEffect(() => {
    referencesAsked.split(",").filter((reference) => reference !== "").forEach((reference) => {
      loadReferenceChoices(reference as Reference).then(
        (choices) => setReferred((was) => ({ ...was, [reference]: choices })),
        () => setReferred((was) => ({ ...was, [reference]: [] })),
      );
    });
  }, [referencesAsked]);
  const answers = { ...kept, ...answersOf(fields, values) };
  const complete = fields.every((field) => !field.required || field.prompt in answers);
  const set = (prompt: string, value: string) => setValues((was) => ({ ...was, [prompt]: value }));
  const save = async () => {
    setSaving(true);
    setRefused("");
    try {
      const reply = await saveRegisterRow(recordCode, answers, edit ? { replaces: edit.rowId } : {});
      const newId = edit ? savedRowId(reply) : "";
      navigate(newId && back.toSaved ? back.toSaved(newId) : back.to);
    } catch (error) {
      setRefused(refusalWords(error));
      setSaving(false);
    }
  };
  return (
    <Shell title={title} titleUnder backLabel={back.label} onBack={() => navigate(back.to)} tabless>
      {fields.map((field) =>
        field.assets ? (
          <ReferencePicker key={field.prompt} label={optionalWords(field)} choices={assets} value={values[field.prompt] ?? ""} onChange={(value) => set(field.prompt, value)} />
        ) : field.people ? (
          <ReferencePicker key={field.prompt} label={optionalWords(field)} choices={people} value={values[field.prompt] ?? ""} onChange={(value) => set(field.prompt, value)} />
        ) : field.refers ? (
          <ReferencePicker key={field.prompt} label={optionalWords(field)} choices={referred[field.refers] ?? []} status={referred[field.refers] ? undefined : "loading"} value={values[field.prompt] ?? ""} onChange={(value) => set(field.prompt, value)} />
        ) : field.options && field.multi ? (
          <ChoiceGroup key={field.prompt} label={optionalWords(field)}>
            {field.options.map((option) => (
              <ChoiceRow key={option} type="checkbox" label={option} checked={chosenOf(values[field.prompt]).includes(option)} onChange={(on) => set(field.prompt, field.options!.filter((one) => (one === option ? on : chosenOf(values[field.prompt]).includes(one))).join(joiner))} />
            ))}
          </ChoiceGroup>
        ) : field.options ? (
          <ChoiceGroup key={field.prompt} label={optionalWords(field)}>
            {field.options.map((option) => (
              <ChoiceRow key={option} type="radio" name={field.prompt} label={option} checked={values[field.prompt] === option} onChange={() => set(field.prompt, option)} />
            ))}
          </ChoiceGroup>
        ) : (
          <Field key={field.prompt} type={field.kind ?? "text"} label={optionalWords(field)} value={values[field.prompt] ?? ""} onChange={(event) => set(field.prompt, event.target.value)} />
        ),
      )}
      {refused ? <LoadFailed words={refused} /> : null}
      <Button kind="primary" disabled={saving || !complete} onClick={save}>Save</Button>
    </Shell>
  );
}
