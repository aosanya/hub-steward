import { MenuEditForm } from "../../MenuEditForm";
import { text, type Item } from "./staffData";

const nameFields = [{ label: "Name", key: "name", required: true }];

const resentKeys = ["NodeType", "AnchorLevelOverrideID"];

export const groupKept = (group: Item) => ({
  NodeType: text(group, "node_type"),
  AnchorLevelOverrideID: text(group, "anchor_level_override"),
});

export function GroupEdit({ group, onSaved }: { group: Item; onSaved: () => void }) {
  return <MenuEditForm item={group} id={text(group, "id")} idArg="group_id" tool="actor_edit_group" permission="group.manage" fields={nameFields} keep={resentKeys} onSaved={onSaved} />;
}
