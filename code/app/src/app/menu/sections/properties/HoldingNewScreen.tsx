import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWord } from "../../../../features/agency/useWord";
import { useLoad } from "../../../../features/forms/useLoad";
import { Button } from "../../../../shared/ui/Button";
import { ChoiceGroup, ChoiceRow } from "../../../../shared/ui/ChoiceRow";
import { Field } from "../../../../shared/ui/Field";
import { LoadFailed } from "../../../../shared/ui/LoadState";
import { SearchSelect, type Choice } from "../../../../shared/ui/SearchSelect";
import { callTool } from "../../../../shared/wakala/mcp";
import { openAgencyId } from "../../../../shared/wakala/openAgency";
import { Shell } from "../../../Shell";
import { refusalWords } from "../../MenuEditForm";
import { holdingFields, holdingRecordCode, useRegisterDetails, writeRegisterAnswers } from "../../registerDetails";
import { placePaths } from "./paths";
import { loadPersonNameChoices } from "../../referenceChoices";
import { itemOf, loadNodeNames, loadPropertyChoices, textOf } from "./records";

export const holdingKinds = ["owner", "tenant", "leaseholder", "occupant", "custodian"];

const tenureCreate = "digitaltwin_tenure_create";

const loadNodeChoices = async (): Promise<Choice[]> => [...(await loadNodeNames())].map(([value, label]) => ({ value, label }));

const loadPlaceChoices = async (): Promise<Choice[]> => {
  const properties = await loadPropertyChoices().catch((): Choice[] => []);
  return properties.length > 0 ? properties : loadNodeChoices();
};

const labelOf = (prompt: string, required: boolean) => (required ? prompt : `${prompt} (optional)`);

const instantOf = (day: string) => `${day}T00:00:00Z`;

const filledOnly = (values: Record<string, string>) => Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value.trim()]).filter(([, value]) => value !== ""));

export function HoldingNewScreen() {
  const navigate = useNavigate();
  const word = useWord("digitaltwin");
  const details = useRegisterDetails(holdingRecordCode, holdingFields);
  const places = useLoad(loadPlaceChoices, `holding-new-places:${openAgencyId()}`);
  const people = useLoad(loadPersonNameChoices, `holding-new-people:${openAgencyId()}`);
  const [holder, setHolder] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [refused, setRefused] = useState("");
  const asked = details.filter((detail) => detail.on);
  const set = (prompt: string, value: string) => setValues((was) => ({ ...was, [prompt]: value }));
  const valueOf = (prompt: string) => (values[prompt] ?? "").trim();
  const complete = holder.trim() !== "" && asked.every((detail) => !detail.required || valueOf(detail.prompt) !== "");
  const ownGiven = () => filledOnly(Object.fromEntries(asked.filter((detail) => detail.own).map((detail) => [detail.prompt, valueOf(detail.prompt)])));
  const body = () => ({
    holder: holder.trim(),
    place_id: valueOf("Property"),
    ...(valueOf("Kind") ? { kind: valueOf("Kind") } : {}),
    ...(valueOf("Since") ? { since: instantOf(valueOf("Since")) } : {}),
  });
  const save = async () => {
    setSaving(true);
    setRefused("");
    try {
      const id = textOf(itemOf(await callTool("", tenureCreate, body())).id);
      const given = ownGiven();
      if (id && Object.keys(given).length > 0) await writeRegisterAnswers(holdingRecordCode, id, given);
      navigate(placePaths.ownership.path(id ? { holding: id } : undefined));
    } catch (error) {
      setRefused(refusalWords(error));
      setSaving(false);
    }
  };
  const ask = (detail: (typeof asked)[number]) => {
    const label = labelOf(detail.prompt, detail.required);
    if (!detail.own && detail.prompt === "Property") {
      return <SearchSelect key={detail.prompt} label={label} choices={places.state === "ready" ? places.data : []} value={values.Property ?? ""} onChange={(value) => set("Property", value)} />;
    }
    if (!detail.own && detail.prompt === "Kind") {
      return (
        <ChoiceGroup key={detail.prompt} label={label}>
          {holdingKinds.map((kind) => (
            <ChoiceRow key={kind} type="radio" name="Kind" label={kind} checked={values.Kind === kind} onChange={() => set("Kind", kind)} />
          ))}
        </ChoiceGroup>
      );
    }
    const date = !detail.own && detail.prompt === "Since";
    return <Field key={detail.prompt} label={label} type={date ? "date" : "text"} value={values[detail.prompt] ?? ""} onChange={(event) => set(detail.prompt, event.target.value)} />;
  };
  return (
    <Shell title="Add holding" titleUnder backLabel={word("Ownership & Tenure")} onBack={() => navigate(placePaths.ownership.path())} tabless>
      <SearchSelect label="Holder" choices={people.state === "ready" ? people.data : []} value={holder} onChange={setHolder} />
      {asked.map(ask)}
      {refused ? <LoadFailed words={refused} /> : null}
      <Button kind="primary" disabled={saving || !complete} onClick={save}>Save</Button>
    </Shell>
  );
}
