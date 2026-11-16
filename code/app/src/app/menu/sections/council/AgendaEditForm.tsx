import { useState } from "react";
import { useMay } from "../../../../features/agency/useMay";
import { Button } from "../../../../shared/ui/Button";
import { LoadFailed } from "../../../../shared/ui/LoadState";
import { TextArea } from "../../../../shared/ui/TextArea";
import { callTool } from "../../../../shared/wakala/mcp";
import { refusalWords } from "../../MenuEditForm";
import { councilTools } from "./councilData";

export const manageCouncil = "council.manage";

export const agendaLines = (items: string[]) => items.join("\n");

export const agendaItems = (lines: string) =>
  lines
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");

type Props = { meetingId: string; items: string[]; onSaved: () => void };

export function AgendaEditForm({ meetingId, items, onSaved }: Props) {
  const may = useMay(manageCouncil);
  const [editing, setEditing] = useState(false);
  const [lines, setLines] = useState("");
  const [saving, setSaving] = useState(false);
  const [refused, setRefused] = useState("");
  if (!may) return null;
  const changed = agendaLines(agendaItems(lines)) !== agendaLines(items);
  const open = () => {
    setLines(agendaLines(items));
    setRefused("");
    setEditing(true);
  };
  const save = async () => {
    setSaving(true);
    setRefused("");
    try {
      await callTool("", councilTools.agendaSet, { meetingID: meetingId, items: agendaItems(lines) });
      setEditing(false);
      onSaved();
    } catch (error) {
      setRefused(refusalWords(error));
    } finally {
      setSaving(false);
    }
  };
  if (!editing) return <Button kind="quiet" onClick={open}>Edit</Button>;
  return (
    <>
      <TextArea label="Agenda items, one per line" rows={6} value={lines} onChange={(event) => setLines(event.target.value)} />
      <Button kind="primary" disabled={saving || !changed} onClick={save}>Save</Button>
      <Button kind="quiet" disabled={saving} onClick={() => setEditing(false)}>Cancel</Button>
      {refused ? <LoadFailed words={refused} /> : null}
    </>
  );
}
