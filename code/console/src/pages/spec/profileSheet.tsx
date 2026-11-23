import { useId, useState } from "react";
import { useLocation } from "react-router-dom";
import { profileFillIn } from "../../data/chatFill";
import { useI18n } from "../../i18n";
import type { PageRow } from "../../types";
import { Button, Card, Row, SettingRows, StatusLine, TextareaControl, TextControl, PageHeader } from "../../ui";
import { useOutcomeNote } from "./profileOutcome";
import { sendAction } from "./sendAction";
import { useAutosave, useSaveWhenIdle } from "./useAutosave";

type ProfileSheetProps = { hubId: string; row: PageRow; reload: () => void };

const textOf = (value: unknown) => (typeof value === "string" ? value : "");

export function ProfileSheet({ hubId, row, reload }: ProfileSheetProps) {
  const { t } = useI18n();
  const ids = { name: useId(), purpose: useId() };
  const fill = profileFillIn(useLocation().state);
  const [name, setName] = useState(fill?.name || textOf(row.name));
  const [purpose, setPurpose] = useState(fill?.purpose || textOf(row.purpose));
  const [saved, setSaved] = useState({ name: textOf(row.name), purpose: textOf(row.purpose) });
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [refused, setRefused] = useState("");
  const [autosave, setAutosave] = useAutosave();
  const [missing, setMissing] = useState(false);
  const [sending, setSending] = useState(false);
  const { note, report, clear } = useOutcomeNote(reload);
  const agencyId = textOf(row.id);

  const changed = name !== saved.name || purpose !== saved.purpose;
  const edit = JSON.stringify([name, purpose]);

  const save = async () => {
    if (sending) return;
    if (!name.trim()) {
      setMissing(true);
      return;
    }
    setMissing(false);
    if (!changed) return;
    setSending(true);
    const result = await sendAction("profile", "profile", hubId, { name, description: purpose });
    setSending(false);
    if (result !== "done") {
      setRefused(edit);
      return report(result);
    }
    setSaved({ name, purpose });
    setSavedAt(new Date());
    clear();
  };

  useSaveWhenIdle(autosave && changed && !sending && edit !== refused && !!name.trim(), save, edit);

  const copy = () => navigator.clipboard?.writeText(agencyId);
  const lastSaved = savedAt?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const status = sending ? [{ text: t("profile.saving") }] : lastSaved ? [{ text: t("profile.lastSaved").replace("{time}", lastSaved) }] : [];

  return (
    <>
      <PageHeader
        title={t("menu.profile")}
        meta={status}
        switches={[{ label: t("autosave"), on: autosave, onChange: setAutosave }]}
        actions={autosave ? [] : [{ label: t("profile.saveChanges"), icon: "check", primary: true, onClick: save, flash: changed }]}
      />
      <div className="content">
        {note.text ? <StatusLine text={note.text} failed={note.failed} /> : null}
        <Card>
          <SettingRows
            rows={[
              {
                label: t("field.name"),
                htmlFor: ids.name,
                control: (
                  <>
                    <TextControl id={ids.name} label={t("field.name")} value={name} onChange={setName} />
                    {missing ? (
                      <span className="field-error" role="alert">
                        {t("required")}: {t("field.name")}
                      </span>
                    ) : null}
                  </>
                ),
              },
              {
                label: t("field.purpose"),
                htmlFor: ids.purpose,
                control: <TextareaControl id={ids.purpose} label={t("field.purpose")} rows={9} value={purpose} onChange={setPurpose} />,
              },
              {
                label: t("profile.agencyId"),
                control: (
                  <Row gap={10}>
                    <span className="count">{agencyId}</span>
                    <Button kind="quiet" size="sm" icon="link" onClick={copy}>
                      {t("copy")}
                    </Button>
                  </Row>
                ),
              },
            ]}
          />
        </Card>
      </div>
    </>
  );
}
