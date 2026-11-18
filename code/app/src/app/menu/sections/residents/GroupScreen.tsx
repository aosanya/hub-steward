import { useState } from "react";
import { useMay } from "../../../../features/agency/useMay";
import { ListRow } from "../../../../shared/ui/ListRow";
import { Section } from "../../../../shared/ui/Section";
import { useNavigate } from "react-router-dom";
import { LoadFailed } from "../../../../shared/ui/LoadState";
import { callTool } from "../../../../shared/wakala/mcp";
import { MenuEditForm, refusalWords } from "../../MenuEditForm";
import { populationFigure } from "../../populationFigure";
import { groupTypeWord } from "../../groupTypeWords";
import { useLanguage } from "../../../../shared/language/language";
import type { Words } from "../../../../shared/language/words";

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

function HiddenAct({ group, onSaved, onRefused }: { group: Item; onSaved: () => void; onRefused: (words: string) => void }) {
  const may = useMay("group.settings");
  const [saving, setSaving] = useState(false);
  if (!may) return null;
  const hidden = group.hidden === true;
  const toggle = async () => {
    setSaving(true);
    onRefused("");
    try {
      await callTool("", "actor_set_group_hidden", { group_id: text(group, "id"), hidden: !hidden });
      onSaved();
    } catch (error) {
      onRefused(refusalWords(error));
    } finally {
      setSaving(false);
    }
  };
  return <button type="button" className="sec-act" disabled={saving} onClick={toggle}>{hidden ? "Show" : "Hide"}</button>;
}

function EditAct({ to }: { to: string }) {
  const mayName = useMay("group.manage");
  const mayJoin = useMay("group.settings");
  const navigate = useNavigate();
  if (!mayName && !mayJoin) return null;
  return <button type="button" className="sec-act" onClick={() => navigate(to)}>Edit</button>;
}

const nodeWords = (group: Item, words: Words) => {
  const type = text(group, "node_type");
  return type ? groupTypeWord(type, words) : "";
};

export function GroupHead({ group }: { group: Item }) {
  const { words } = useLanguage();
  const line = [nodeWords(group, words), text(group, "members")].filter(Boolean).join(" · ");
  return (
    <div className="title-block">
      <h1 className="person-name">{text(group, "name")}</h1>
      {line ? <p className="quiet-line">{line}</p> : null}
    </div>
  );
}

export function GroupDetails({ group, onSaved, editPath }: { group: Item; onSaved: () => void; editPath: string }) {
  const [refused, setRefused] = useState("");
  const rows = [
    <ListRow key="name" title="Name" meta={text(group, "name")} />,
    <ListRow key="join" title="Joining" meta={text(group, "join_mode")} />,
    ...(text(group, "members") ? [<ListRow key="members" title="Members" meta={text(group, "members")} />] : []),
    <ListRow key="hidden" title="Hidden" meta={text(group, "hiddenWords")} />,
  ];
  const foot = (
    <>
      <EditAct to={editPath} />
      <HiddenAct group={group} onSaved={onSaved} onRefused={setRefused} />
    </>
  );
  return (
    <>
      <Section word="Group detail" plain foot={foot} rows={rows} />
      {refused ? <LoadFailed words={refused} /> : null}
    </>
  );
}

export function GroupPanel({ group, onSaved, editPath }: { group: Item; onSaved: () => void; editPath: string }) {
  return (
    <div className="person-page">
      <GroupHead group={group} />
      <div className="sections">
        <GroupDetails group={group} onSaved={onSaved} editPath={editPath} />
      </div>
    </div>
  );
}

export function GroupEdit({ group, onDone }: { group: Item; onDone: () => void }) {
  const id = text(group, "id");
  const mayName = useMay("group.manage");
  const mayJoin = useMay("group.settings");
  if (!mayName) {
    return <MenuEditForm item={group} id={id} idArg="group_id" tool="actor_set_group_join_mode" permission="group.settings" bare openCount={1} fields={joinFields} onSaved={onDone} onCancel={onDone} />;
  }
  const fields = mayJoin ? [...nameFields, ...joinFields] : nameFields;
  const build = (sent: Record<string, unknown>) => ({ group_id: id, NodeType: text(group, "NodeType"), AnchorLevelOverrideID: text(group, "AnchorLevelOverrideID"), name: sent.name });
  const alsoSave = async (changed: Record<string, string>) => {
    if ("join_mode" in changed) await callTool("", "actor_set_group_join_mode", { group_id: id, join_mode: changed.join_mode });
  };
  return <MenuEditForm item={group} id={id} idArg="group_id" tool="actor_edit_group" permission="group.manage" bare openCount={1} fields={fields} build={build} alsoSave={alsoSave} onSaved={onDone} onCancel={onDone} />;
}
