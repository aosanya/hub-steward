import { useState, type FormEvent } from "react";
import { commentFinding, type Finding } from "../../data/reviewApi";
import { useI18n } from "../../i18n";
import { Button, StatusLine, TextControl } from "../../ui";

type Props = {
  hubId: string;
  finding: Finding;
  onFinding: (finding: Finding) => void;
  open: boolean;
  onClose: () => void;
};

const oldestFirst = (finding: Finding) =>
  [...finding.comments].sort((a, b) => a.created_at.localeCompare(b.created_at));

export function FindingNotes({ hubId, finding, onFinding, open, onClose }: Props) {
  const { t } = useI18n();
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState("");
  const body = text.trim();

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!body || saving) return;
    setSaving(true);
    setFailure("");
    try {
      const saved = await commentFinding(hubId, finding.id, body);
      onFinding({ ...finding, comments: [...finding.comments, saved] });
      setText("");
      onClose();
    } catch (error) {
      setFailure(error instanceof Error && error.message ? error.message : t("review.commentFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="finding-notes">
      {finding.comments.length ? (
        <ul>
          {oldestFirst(finding).map((note) => (
            <li key={note.id}>
              <strong>{note.author}</strong> {note.body}
            </li>
          ))}
        </ul>
      ) : null}
      {open ? (
        <form className="row-ask" onSubmit={save}>
          <TextControl
            label={t("review.comment")}
            placeholder={t("review.commentPlaceholder")}
            value={text}
            onChange={setText}
          />
          <Button kind="quiet" size="xs" type="submit" disabled={!body || saving}>
            {t("review.commentSave")}
          </Button>
        </form>
      ) : null}
      {failure ? <StatusLine text={failure} failed /> : null}
    </div>
  );
}
