import { useState } from "react";
import { Button } from "../../../../shared/ui/Button";
import { Field } from "../../../../shared/ui/Field";
import { LoadFailed } from "../../../../shared/ui/LoadState";
import { callTool } from "../../../../shared/wakala/mcp";
import { refusalWords } from "../../MenuEditForm";

export type Languages = { studioDefault: string; content: string[]; contentDefault: string };

const codesOf = (text: string) =>
  text
    .split(",")
    .map((code) => code.trim())
    .filter((code) => code !== "");

export function useLanguagesEdit(current: Languages, onSaved: () => void) {
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [refused, setRefused] = useState("");
  const save = async () => {
    setSaving(true);
    setRefused("");
    try {
      await callTool("", "instance_set_languages", {
        studio_default: current.studioDefault,
        content: codesOf(draft ?? ""),
        content_default: current.contentDefault,
      });
      setDraft(null);
      onSaved();
    } catch (error) {
      setRefused(refusalWords(error));
    } finally {
      setSaving(false);
    }
  };
  const act =
    draft === null ? (
      <button type="button" className="sec-act" onClick={() => setDraft(current.content.join(", "))}>
        Change languages
      </button>
    ) : undefined;
  const form =
    draft === null ? null : (
      <div key="languages-form" className="sec-tools">
        <Field label="Content languages" value={draft} onChange={(event) => setDraft(event.target.value)} />
        <Button kind="primary" disabled={saving || codesOf(draft).length === 0} onClick={save}>Save languages</Button>
        <Button kind="quiet" disabled={saving} onClick={() => setDraft(null)}>Cancel</Button>
        {refused ? <LoadFailed words={refused} /> : null}
      </div>
    );
  return { act, form };
}
