import { useState } from "react";
import { useMay } from "../../../../features/agency/useMay";
import { Button } from "../../../../shared/ui/Button";
import { LoadFailed } from "../../../../shared/ui/LoadState";
import { callTool } from "../../../../shared/wakala/mcp";
import { MenuEditForm, refusalWords } from "../../MenuEditForm";
import { populationFigure } from "../../populationFigure";

type Item = Record<string, unknown>;

const text = (item: Item, key: string) => {
  const value = item[key];
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
};

export const loadGroup = async (id: string): Promise<Item> => {
  const reply = (await callTool("", "actor_get_group", { group_id: id })) as { item?: Item } | Item | null;
  const group = ((reply as { item?: Item } | null)?.item ?? reply ?? {}) as Item;
  const count = await populationFigure(id);
  return {
    ...group,
    id,
    NodeType: text(group, "node_type"),
    AnchorLevelOverrideID: text(group, "anchor_level_override"),
    members: count === null ? "" : `${count} members`,
    hiddenWords: group.hidden === true ? "yes" : "no",
  };
};

const nameFields = [{ label: "Name", key: "name", required: true }];

const joinFields = [{ label: "Joining", key: "join_mode", required: true }];

function HiddenToggle({ group, onSaved }: { group: Item; onSaved: () => void }) {
  const may = useMay("group.settings");
  const [saving, setSaving] = useState(false);
  const [refused, setRefused] = useState("");
  if (!may) return null;
  const hidden = group.hidden === true;
  const toggle = async () => {
    setSaving(true);
    setRefused("");
    try {
      await callTool("", "actor_set_group_hidden", { group_id: text(group, "id"), hidden: !hidden });
      onSaved();
    } catch (error) {
      setRefused(refusalWords(error));
    } finally {
      setSaving(false);
    }
  };
  return (
    <>
      <Button kind="quiet" disabled={saving} onClick={toggle}>{hidden ? "Show" : "Hide"}</Button>
      {refused ? <LoadFailed words={refused} /> : null}
    </>
  );
}

export function GroupPanel({ group, onSaved }: { group: Item; onSaved: () => void }) {
  const id = text(group, "id");
  return (
    <>
      <MenuEditForm item={group} id={id} idArg="group_id" tool="actor_edit_group" permission="group.manage" fields={nameFields} keep={["NodeType", "AnchorLevelOverrideID"]} onSaved={onSaved} />
      <MenuEditForm item={group} id={id} idArg="group_id" tool="actor_set_group_join_mode" permission="group.settings" fields={joinFields} onSaved={onSaved} />
      <HiddenToggle group={group} onSaved={onSaved} />
    </>
  );
}
