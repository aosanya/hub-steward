import { useMay } from "../../../../features/agency/useMay";
import { itemsOf } from "../../../../features/backlogs";
import { useLoad } from "../../../../features/forms/useLoad";
import { ListRow, Rows } from "../../../../shared/ui/ListRow";
import { callTool } from "../../../../shared/wakala/mcp";
import { openAgencyId } from "../../../../shared/wakala/openAgency";
import { MenuEditForm, type EditField } from "../../MenuEditForm";

type Item = Record<string, unknown>;

const loadTextFields = async (): Promise<EditField[]> =>
  (itemsOf(await callTool("", "actor_list_attribute_properties")) as Item[])
    .filter((property) => property.range === "text" && typeof property.name === "string")
    .map((property) => ({ key: String(property.name), label: String(property.label ?? property.name), required: property.required === true }));

const attributesOf = (person: Item): Item => (person.attributes && typeof person.attributes === "object" ? (person.attributes as Item) : {});

export function PersonAttributesEdit({ id, person, onSaved }: { id: string; person: Item; onSaved: () => void }) {
  const may = useMay("member.edit");
  const view = useLoad(async () => (may ? loadTextFields() : []), `person-attribute-properties:${openAgencyId()}:${may}`);
  const fields = view.state === "ready" ? view.data : [];
  if (fields.length === 0) return null;
  const attributes = attributesOf(person);
  const filled = fields.filter((field) => attributes[field.key] !== undefined && attributes[field.key] !== "");
  return (
    <>
      <Rows>
        {filled.map((field) => (
          <ListRow key={field.key} title={field.label} meta={String(attributes[field.key])} />
        ))}
      </Rows>
      <MenuEditForm
        item={attributes}
        id={id}
        idArg="actor_id"
        tool="actor_set_actor_attributes"
        permission="member.edit"
        editLabel="Edit attributes"
        fields={fields}
        build={(sent) => ({ actor_id: id, attributes: sent })}
        onSaved={onSaved}
      />
    </>
  );
}
