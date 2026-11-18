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
import { residentPaths } from "./paths";

type Item = Record<string, unknown>;

type TextProperty = { key: string; label: string };

const loadTextProperties = async (): Promise<TextProperty[]> =>
  (itemsOf(await callTool("", "actor_list_attribute_properties")) as Item[])
    .filter((property) => property.range === "text" && typeof property.name === "string")
    .map((property) => ({ key: String(property.name), label: String(property.label ?? property.name) }));

const filledOnly = (values: Record<string, string>) => Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value.trim()]).filter(([, value]) => value !== ""));

export function PersonNewScreen() {
  const navigate = useNavigate();
  const properties = useLoad(loadTextProperties, `person-new-properties:${openAgencyId()}`);
  const [name, setName] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [refused, setRefused] = useState("");
  const fields = properties.state === "ready" ? properties.data : [];
  const save = async () => {
    setSaving(true);
    setRefused("");
    try {
      await callTool("", "actor_create_actor", { display_name: name.trim(), is_agentic: false, attributes: filledOnly(values) });
      navigate(residentPaths.people.path());
    } catch (error) {
      setRefused(refusalWords(error));
      setSaving(false);
    }
  };
  return (
    <Shell title="Add person" titleUnder backLabel="All People" onBack={() => navigate(residentPaths.people.path())} tabless>
      <Field label="Name" value={name} onChange={(event) => setName(event.target.value)} />
      {fields.map((field) => (
        <Field key={field.key} label={`${field.label} (optional)`} value={values[field.key] ?? ""} onChange={(event) => setValues((was) => ({ ...was, [field.key]: event.target.value }))} />
      ))}
      {refused ? <LoadFailed words={refused} /> : null}
      <Button kind="primary" disabled={saving || name.trim() === ""} onClick={save}>Save</Button>
    </Shell>
  );
}
