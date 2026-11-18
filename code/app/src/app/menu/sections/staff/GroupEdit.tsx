import { MenuEditForm } from "../../MenuEditForm";
import { groupEditTool, groupNameBuild, groupNameFields } from "../../groupEdit";
import { text, type Item } from "./staffData";

export function GroupEdit({ group, onSaved }: { group: Item; onSaved: () => void }) {
  const id = text(group, "id");
  return <MenuEditForm item={group} id={id} idArg="group_id" tool={groupEditTool} permission="group.manage" fields={groupNameFields} build={groupNameBuild(id, group)} onSaved={onSaved} />;
}
