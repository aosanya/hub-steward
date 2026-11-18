import { callTool } from "../../../../shared/wakala/mcp";
import { MenuEditForm, type EditField } from "../../MenuEditForm";
import { PersonAttributesInline, usePersonAttributes } from "./PersonAttributesEdit";

type Item = Record<string, unknown>;

const nameKey = "display_name";

const nameField: EditField = { label: "Name", key: nameKey, required: true };

const nameFields = [nameField];

type Props = { id: string; person: Item; onDone: () => void };

export function PersonEdit({ id, person, onDone }: Props) {
  const { fields, item, build, alsoSave, ready } = usePersonAttributes(id, person);
  if (!ready) return null;
  const withName: Item = { ...item, [nameKey]: person[nameKey] };
  const buildWithoutName = (sent: Record<string, unknown>) => build(Object.fromEntries(Object.entries(sent).filter(([key]) => key !== nameKey)));
  const saveAlso = async (changed: Record<string, string>) => {
    await alsoSave(changed);
    if (nameKey in changed) await callTool("", "actor_set_actor_display_name", { actor_id: id, [nameKey]: changed[nameKey] });
  };
  const formFields = [nameField, ...fields];
  return <MenuEditForm key={formFields.map((field) => field.key).join("|")} item={withName} id={id} idArg="actor_id" tool="actor_set_actor_attributes" permission="member.edit" bare openCount={1} fields={formFields} build={buildWithoutName} alsoSave={saveAlso} onSaved={onDone} onCancel={onDone} />;
}

export function PersonEditInline({ id, person, onSaved }: { id: string; person: Item; onSaved: () => void }) {
  return (
    <>
      <MenuEditForm item={person} id={id} idArg="actor_id" tool="actor_set_actor_display_name" permission="member.edit" fields={nameFields} onSaved={onSaved} />
      <PersonAttributesInline id={id} person={person} onSaved={onSaved} />
    </>
  );
}
