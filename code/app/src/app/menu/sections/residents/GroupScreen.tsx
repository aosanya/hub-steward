import { useState } from "react";
import { useParams } from "react-router-dom";
import { useWord } from "../../../../features/agency/useWord";
import { useMay } from "../../../../features/agency/useMay";
import { useLoad } from "../../../../features/forms/useLoad";
import { Button } from "../../../../shared/ui/Button";
import { ListRow, Rows } from "../../../../shared/ui/ListRow";
import { LoadFailed, LoadingLine } from "../../../../shared/ui/LoadState";
import { callTool } from "../../../../shared/wakala/mcp";
import { openAgencyId } from "../../../../shared/wakala/openAgency";
import { Shell } from "../../../Shell";
import { loadFailedWords } from "../../MenuDetail";
import { MenuEditForm, refusalWords } from "../../MenuEditForm";
import { useBackToSection } from "../../useBackToSection";

type Item = Record<string, unknown>;

const text = (item: Item, key: string) => {
  const value = item[key];
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
};

const loadGroup = async (id: string): Promise<Item> => {
  const reply = (await callTool("", "actor_get_group", { group_id: id })) as { item?: Item } | Item | null;
  const group = ((reply as { item?: Item } | null)?.item ?? reply ?? {}) as Item;
  return { ...group, NodeType: text(group, "node_type"), AnchorLevelOverrideID: text(group, "anchor_level_override") };
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

export function GroupScreen() {
  const back = useBackToSection();
  const word = useWord("actor");
  const id = useParams().id ?? "";
  const [version, setVersion] = useState(0);
  const view = useLoad(() => loadGroup(id), `group-detail:${openAgencyId()}:${id}:${version}`);
  const group = view.state === "ready" ? view.data : {};
  const saved = () => setVersion((was) => was + 1);
  return (
    <Shell title={word("Group")} titleUnder {...back}>
      {view.state === "loading" ? <LoadingLine /> : null}
      {view.state === "error" ? <LoadFailed words={loadFailedWords} /> : null}
      {view.state === "ready" ? (
        <>
          <Rows>
            <ListRow title="Name" meta={text(group, "name")} />
            <ListRow title="Joining" meta={text(group, "join_mode")} />
            <ListRow title="Hidden" meta={group.hidden === true ? "yes" : "no"} />
          </Rows>
          <MenuEditForm item={group} id={id} idArg="group_id" tool="actor_edit_group" permission="group.manage" fields={nameFields} keep={["NodeType", "AnchorLevelOverrideID"]} onSaved={saved} />
          <MenuEditForm item={group} id={id} idArg="group_id" tool="actor_set_group_join_mode" permission="group.settings" fields={joinFields} onSaved={saved} />
          <HiddenToggle group={group} onSaved={saved} />
        </>
      ) : null}
    </Shell>
  );
}
