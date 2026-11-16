import { useState } from "react";
import { useMay } from "../../../../features/agency/useMay";
import { itemsOf } from "../../../../features/backlogs";
import { useLoad } from "../../../../features/forms/useLoad";
import { Button } from "../../../../shared/ui/Button";
import { LoadFailed } from "../../../../shared/ui/LoadState";
import { SearchSelect, type Choice } from "../../../../shared/ui/SearchSelect";
import { callTool } from "../../../../shared/wakala/mcp";
import { openAgencyId } from "../../../../shared/wakala/openAgency";
import { refusalWords } from "../../MenuEditForm";

type Props = { actorId: string; onGiven: () => void };

const choicesOf = (items: Record<string, unknown>[], keep: (item: Record<string, unknown>) => boolean = () => true): Choice[] =>
  items.flatMap((item) => (typeof item.id === "string" && typeof item.name === "string" && item.name !== "" && keep(item) ? [{ value: item.id, label: item.name }] : []));

const roleChoices = async () => choicesOf(itemsOf(await callTool("", "actor_list_role_kinds")), (kind) => !kind.retired_at);

const groupChoices = async () => choicesOf(itemsOf(await callTool("", "actor_list_groups")));

export function SeatGive({ actorId, onGiven }: Props) {
  const may = useMay("role.assign");
  const [kind, setKind] = useState("");
  const [group, setGroup] = useState("");
  const [saving, setSaving] = useState(false);
  const [refused, setRefused] = useState("");
  const kinds = useLoad(roleChoices, `seat-kinds:${openAgencyId()}`);
  const groups = useLoad(groupChoices, `seat-groups:${openAgencyId()}`);
  if (!may) return null;
  const give = async () => {
    setSaving(true);
    setRefused("");
    try {
      await callTool("", "actor_grant_role", { actor_id: actorId, kind_id: kind, group_id: group });
      setKind("");
      setGroup("");
      onGiven();
    } catch (error) {
      setRefused(refusalWords(error));
    } finally {
      setSaving(false);
    }
  };
  return (
    <>
      <SearchSelect label="Role" choices={kinds.state === "ready" ? kinds.data : []} value={kind} onChange={setKind} />
      <SearchSelect label="Group" choices={groups.state === "ready" ? groups.data : []} value={group} onChange={setGroup} />
      <Button kind="primary" disabled={saving || kind === "" || group === ""} onClick={give}>Give role</Button>
      {refused ? <LoadFailed words={refused} /> : null}
    </>
  );
}
