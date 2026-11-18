import { useEffect, useState } from "react";
import { useMay } from "../../../../features/agency/useMay";
import { itemsOf } from "../../../../features/backlogs";
import { useLoad } from "../../../../features/forms/useLoad";
import { ListRow } from "../../../../shared/ui/ListRow";
import { Section } from "../../../../shared/ui/Section";
import { callTool } from "../../../../shared/wakala/mcp";
import { openAgencyId } from "../../../../shared/wakala/openAgency";
import { MenuEditForm, type EditField } from "../../MenuEditForm";
import { readRegisterAnswers, residentFields, residentRecordCode, useRegisterDetails, writeRegisterAnswers, type RegisterAnswers } from "../../registerDetails";

type Item = Record<string, unknown>;

const ownKeyOf = (prompt: string) => `detail:${prompt}`;

const loadTextFields = async (): Promise<EditField[]> =>
  (itemsOf(await callTool("", "actor_list_attribute_properties")) as Item[])
    .filter((property) => property.range === "text" && typeof property.name === "string")
    .map((property) => ({ key: String(property.name), label: String(property.label ?? property.name), required: property.required === true }));

const attributesOf = (person: Item): Item => (person.attributes && typeof person.attributes === "object" ? (person.attributes as Item) : {});

export function PersonAttributesEdit({ id, person, onSaved, openCount }: { id: string; person: Item; onSaved: () => void; openCount?: number }) {
  const may = useMay("member.edit");
  const view = useLoad(async () => (may ? loadTextFields() : []), `person-attribute-properties:${openAgencyId()}:${may}`);
  const details = useRegisterDetails(residentRecordCode, residentFields);
  const [answers, setAnswers] = useState<RegisterAnswers>({});
  useEffect(() => {
    let live = true;
    readRegisterAnswers(residentRecordCode, id).then((kept) => live && setAnswers(kept));
    return () => {
      live = false;
    };
  }, [id]);
  const detailOf = (label: string) => details.find((detail) => !detail.own && detail.prompt === label);
  const attributeFields = (view.state === "ready" ? view.data : [])
    .filter((field) => detailOf(field.label)?.on !== false)
    .map((field) => ({ ...field, required: field.required || detailOf(field.label)?.required === true }));
  const ownFields: EditField[] = details.filter((detail) => detail.own && detail.on).map((detail) => ({ key: ownKeyOf(detail.prompt), label: detail.prompt, required: detail.required }));
  const fields = [...attributeFields, ...ownFields];
  if (fields.length === 0) return null;
  const attributes = attributesOf(person);
  const item: Item = { ...attributes, ...Object.fromEntries(ownFields.map((field) => [field.key, answers[field.label] ?? ""])) };
  const filled = fields.filter((field) => item[field.key] !== undefined && item[field.key] !== "");
  const saveAttributes = (sent: Record<string, unknown>) => {
    const sentAttributes = Object.fromEntries(Object.entries(sent).filter(([key]) => !key.startsWith(ownKeyOf(""))));
    const held = Object.fromEntries(attributeFields.filter((field) => attributes[field.key] !== undefined).map((field) => [field.key, attributes[field.key]]));
    return { actor_id: id, attributes: Object.keys(sentAttributes).length > 0 ? sentAttributes : held };
  };
  const saveAnswers = async (changed: Record<string, string>) => {
    const edited = ownFields.filter((field) => field.key in changed);
    if (edited.length === 0) return;
    const merged = { ...answers, ...Object.fromEntries(edited.map((field) => [field.label, changed[field.key].trim()])) };
    await writeRegisterAnswers(residentRecordCode, id, merged);
    setAnswers(merged);
  };
  return (
    <>
      <Section word="Details" rows={filled.map((field) => <ListRow key={field.key} title={field.label} meta={String(item[field.key])} />)} />
      <MenuEditForm
        item={item}
        id={id}
        idArg="actor_id"
        tool="actor_set_actor_attributes"
        permission="member.edit"
        editLabel="Edit attributes"
        bare={openCount !== undefined}
        openCount={openCount}
        fields={fields}
        build={saveAttributes}
        alsoSave={saveAnswers}
        onSaved={onSaved}
      />
    </>
  );
}
