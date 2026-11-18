import { useMay } from "../../../../features/agency/useMay";
import { ActionsMenu } from "../../../../shared/ui/ActionsMenu";
import { MenuEditForm } from "../../MenuEditForm";
import { PersonAttributesEdit } from "./PersonAttributesEdit";

type Item = Record<string, unknown>;

const nameFields = [{ label: "Name", key: "display_name", required: true }];

type Counts = { name: number; attributes: number };

export const personEditActions = (bump: (key: keyof Counts) => void) => [
  { label: "Edit name", onSelect: () => bump("name") },
  { label: "Edit attributes", onSelect: () => bump("attributes") },
];

export function PersonEditMenu({ bump }: { bump: (key: keyof Counts) => void }) {
  const may = useMay("member.edit");
  return may ? <ActionsMenu label="Edit" actions={personEditActions(bump)} /> : null;
}

export function PersonEdit({ id, person, onSaved, counts }: { id: string; person: Item; onSaved: () => void; counts?: Counts }) {
  return (
    <>
      <MenuEditForm item={person} id={id} idArg="actor_id" tool="actor_set_actor_display_name" permission="member.edit" fields={nameFields} onSaved={onSaved} bare={counts !== undefined} openCount={counts?.name} />
      <PersonAttributesEdit id={id} person={person} onSaved={onSaved} openCount={counts?.attributes} />
    </>
  );
}
