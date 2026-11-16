import { MenuEditForm } from "../../MenuEditForm";

type Item = Record<string, unknown>;

const nameFields = [{ label: "Name", key: "display_name", required: true }];

export function PersonEdit({ id, person, onSaved }: { id: string; person: Item; onSaved: () => void }) {
  return <MenuEditForm item={person} id={id} idArg="actor_id" tool="actor_set_actor_display_name" permission="member.edit" fields={nameFields} onSaved={onSaved} />;
}
