import { MenuEditForm } from "../../MenuEditForm";
import { PersonAttributesEdit, PersonAttributesInline } from "./PersonAttributesEdit";

type Item = Record<string, unknown>;

const nameFields = [{ label: "Name", key: "display_name", required: true }];

export const personEditKinds = { name: "Edit details", attributes: "Edit attributes" } as const;

export type PersonEditKind = keyof typeof personEditKinds;

type Props = { kind: PersonEditKind; id: string; person: Item; onDone: () => void };

export function PersonEdit({ kind, id, person, onDone }: Props) {
  return kind === "attributes" ? (
    <PersonAttributesEdit id={id} person={person} onSaved={onDone} onCancel={onDone} />
  ) : (
    <MenuEditForm item={person} id={id} idArg="actor_id" tool="actor_set_actor_display_name" permission="member.edit" fields={nameFields} bare openCount={1} onSaved={onDone} onCancel={onDone} />
  );
}

export function PersonEditInline({ id, person, onSaved }: { id: string; person: Item; onSaved: () => void }) {
  return (
    <>
      <MenuEditForm item={person} id={id} idArg="actor_id" tool="actor_set_actor_display_name" permission="member.edit" fields={nameFields} onSaved={onSaved} />
      <PersonAttributesInline id={id} person={person} onSaved={onSaved} />
    </>
  );
}
