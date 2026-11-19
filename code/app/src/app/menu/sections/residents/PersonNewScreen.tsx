import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { itemsOf } from "../../../../features/backlogs";
import { useLoad } from "../../../../features/forms/useLoad";
import { Button } from "../../../../shared/ui/Button";
import { Field } from "../../../../shared/ui/Field";
import { LoadFailed } from "../../../../shared/ui/LoadState";
import { callTool } from "../../../../shared/wakala/mcp";
import { openAgencyId } from "../../../../shared/wakala/openAgency";
import { Shell } from "../../../Shell";
import { refusalWords } from "../../MenuEditForm";
import { residentFields, residentRecordCode, useRegisterDetails, writeRegisterAnswers } from "../../registerDetails";
import { residentPaths } from "./paths";

type Item = Record<string, unknown>;

type TextProperty = { key: string; label: string };

const loadTextProperties = async (): Promise<TextProperty[]> =>
  (itemsOf(await callTool("", "actor_list_attribute_properties")) as Item[])
    .filter((property) => property.range === "text" && typeof property.name === "string")
    .map((property) => ({ key: String(property.name), label: String(property.label ?? property.name) }));

const filledOnly = (values: Record<string, string>) => Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value.trim()]).filter(([, value]) => value !== ""));

const createdIdOf = (reply: unknown) => {
  const made = ((reply as { item?: Item } | null)?.item ?? reply) as Item | null;
  return typeof made?.id === "string" ? made.id : "";
};

const labelOf = (prompt: string, required: boolean) => (required ? prompt : `${prompt} (optional)`);

export function PersonNewScreen() {
  const navigate = useNavigate();
  const properties = useLoad(loadTextProperties, `person-new-properties:${openAgencyId()}`);
  const details = useRegisterDetails(residentRecordCode, residentFields);
  const [name, setName] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [createdId, setCreatedId] = useState("");
  const [saving, setSaving] = useState(false);
  const [refused, setRefused] = useState("");
  const detailOf = (prompt: string) => details.find((detail) => !detail.own && detail.prompt === prompt);
  const fields = (properties.state === "ready" ? properties.data : [])
    .filter((field) => detailOf(field.label)?.on !== false)
    .map((field) => ({ ...field, required: detailOf(field.label)?.required === true }));
  const own = details.filter((detail) => detail.own && detail.on);
  const complete =
    name.trim() !== "" &&
    fields.every((field) => !field.required || (values[field.key] ?? "").trim() !== "") &&
    own.every((detail) => !detail.required || (answers[detail.prompt] ?? "").trim() !== "");
  const save = async () => {
    setSaving(true);
    setRefused("");
    try {
      const id = createdId || createdIdOf(await callTool("", "actor_create_actor", { display_name: name.trim(), is_agentic: false, attributes: filledOnly(values) }));
      setCreatedId(id);
      const given = filledOnly(Object.fromEntries(own.map((detail) => [detail.prompt, answers[detail.prompt] ?? ""])));
      if (id && Object.keys(given).length > 0) await writeRegisterAnswers(residentRecordCode, id, given);
      navigate(residentPaths.people.path());
    } catch (error) {
      setRefused(refusalWords(error, fields));
      setSaving(false);
    }
  };
  return (
    <Shell title="Add person" titleUnder backLabel="All People" onBack={() => navigate(residentPaths.people.path())} tabless>
      <Field label="Name" value={name} onChange={(event) => setName(event.target.value)} />
      {fields.map((field) => (
        <Field key={field.key} label={labelOf(field.label, field.required)} value={values[field.key] ?? ""} onChange={(event) => setValues((was) => ({ ...was, [field.key]: event.target.value }))} />
      ))}
      {own.map((detail) => (
        <Field key={detail.prompt} label={labelOf(detail.prompt, detail.required)} value={answers[detail.prompt] ?? ""} onChange={(event) => setAnswers((was) => ({ ...was, [detail.prompt]: event.target.value }))} />
      ))}
      {refused ? <LoadFailed words={refused} /> : null}
      <Button kind="primary" disabled={saving || !complete} onClick={save}>Save</Button>
    </Shell>
  );
}
