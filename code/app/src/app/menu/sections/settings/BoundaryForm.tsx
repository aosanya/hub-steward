import { useState } from "react";
import { useMay } from "../../../../features/agency/useMay";
import { Button } from "../../../../shared/ui/Button";
import { LoadFailed } from "../../../../shared/ui/LoadState";
import { TextArea } from "../../../../shared/ui/TextArea";
import { callTool } from "../../../../shared/wakala/mcp";
import { refusalWords } from "../../MenuEditForm";
import { boundaryArgs, cornersFromText } from "./boundary";

type Props = { groupId: string; shown: string; onSaved: () => void };

const unreadableWords = "Give at least three corners, one longitude and latitude to a line.";

export function BoundaryForm({ groupId, shown, onSaved }: Props) {
  const may = useMay("group.manage");
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [refused, setRefused] = useState("");
  if (!may) return null;
  const corners = cornersFromText(text);
  const readable = text.trim() === "" || corners !== null;
  const open = () => {
    setText(shown);
    setRefused("");
    setEditing(true);
  };
  const save = async () => {
    setSaving(true);
    setRefused("");
    try {
      await callTool("", "actor_set_group_boundary", boundaryArgs(groupId, corners));
      setEditing(false);
      onSaved();
    } catch (error) {
      setRefused(refusalWords(error));
    } finally {
      setSaving(false);
    }
  };
  if (!editing) return <Button kind="quiet" onClick={open}>Edit boundary</Button>;
  return (
    <>
      <TextArea label="Boundary corners" rows={6} value={text} onChange={(event) => setText(event.target.value)} />
      {readable ? null : <LoadFailed words={unreadableWords} />}
      <Button kind="primary" disabled={saving || !readable || text === shown} onClick={save}>Save boundary</Button>
      <Button kind="quiet" disabled={saving} onClick={() => setEditing(false)}>Cancel</Button>
      {refused ? <LoadFailed words={refused} /> : null}
    </>
  );
}
