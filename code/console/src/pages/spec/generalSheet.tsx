import { useId, useState } from "react";
import { useI18n } from "../../i18n";
import type { OptionItem, PageRow } from "../../types";
import { useTheme } from "../../shell/theme";
import { Card, Chip, Row, SelectControl, SettingRows, Stack, StatusLine, ThemePicker, PageHeader } from "../../ui";
import { ListingControl } from "./generalListing";
import { defaultLanguageChoices } from "./generalLanguages";
import { RenameHubForm } from "./generalRename";
import { useOutcomeNote } from "./profileOutcome";
import { sendAction, type Outcome } from "./sendAction";
import "./generalLayout.css";

type GeneralSheetProps = { hubId: string; row: PageRow; reload: () => void };

type Pending = { joining: boolean; language: boolean };

const textOf = (value: unknown) => (typeof value === "string" ? value : "");

const codesOf = (value: unknown) => (Array.isArray(value) ? value.filter((code): code is string => typeof code === "string") : []);

const joinModes = ["open", "confirmed"];

function PendingLine() {
  const { t } = useI18n();
  return (
    <Row gap={10}>
      <Chip kind="warn">{t("general.pendingTag")}</Chip>
      <span className="muted">{t("general.nothingRecorded")}</span>
    </Row>
  );
}

export function GeneralSheet({ hubId, row, reload }: GeneralSheetProps) {
  const { t } = useI18n();
  const { theme, setTheme } = useTheme();
  const ids = { joining: useId(), language: useId() };
  const savedJoining = textOf(row.joining);
  const savedLanguage = textOf(row.default_language);
  const [joining, setJoining] = useState(savedJoining);
  const savedListed = typeof row.listed === "boolean" ? row.listed : null;
  const [language, setLanguage] = useState(savedLanguage);
  const [listed, setListed] = useState(savedListed === true);
  const [pending, setPending] = useState<Pending>({ joining: false, language: false });
  const [renaming, setRenaming] = useState(false);
  const [sending, setSending] = useState(false);
  const { note, report, clear } = useOutcomeNote(reload);

  const joinOptions: OptionItem[] = [
    ...(joinModes.includes(joining) ? [] : [{ value: joining, label: "-" }]),
    { value: "open", label: t("joinOpen") },
    { value: "confirmed", label: t("general.joinConfirmed") },
  ];
  const codes = codesOf(row.languages);
  const languageOptions = defaultLanguageChoices(!language || codes.includes(language) ? codes : [language, ...codes]);

  const pick = (field: keyof Pending, set: (value: string) => void) => (value: string) => {
    set(value);
    setPending((current) => ({ ...current, [field]: false }));
  };

  const save = async () => {
    if (sending) return;
    const sends: { field: keyof Pending | "listing"; run: Promise<Outcome> }[] = [];
    if (joining !== savedJoining && joinModes.includes(joining))
      sends.push({ field: "joining", run: sendAction("general", "general", hubId, { join_mode: joining }) });
    if (language !== savedLanguage && language)
      sends.push({ field: "language", run: sendAction("general", "language", hubId, { language }) });
    if (savedListed !== null && listed !== savedListed)
      sends.push({ field: "listing", run: sendAction("general", "listing", hubId, { listed }) });
    if (sends.length === 0) return;
    setSending(true);
    const results = await Promise.all(sends.map((send) => send.run));
    setSending(false);
    const worst = results.includes("failed") ? "failed" : results.includes("done") ? "done" : "accepted";
    setPending({
      joining: sends.some((send, i) => send.field === "joining" && results[i] === "accepted"),
      language: sends.some((send, i) => send.field === "language" && results[i] === "accepted"),
    });
    if (worst === "failed") report("failed");
    else if (worst === "done") report("done");
    else clear();
  };

  const renamed = (result: Outcome) => {
    report(result);
    setRenaming(false);
  };

  const control = (
    id: string,
    label: string,
    value: string,
    options: OptionItem[],
    onChange: (value: string) => void,
    waiting: boolean,
  ) => {
    const select = <SelectControl id={id} label={label} value={value} options={options} onChange={onChange} />;
    if (!waiting) return select;
    return (
      <Stack gap={8}>
        {select}
        <PendingLine />
      </Stack>
    );
  };

  return (
    <>
      <PageHeader
        title={t("menu.general")}
        actions={[
          {
            label: t("general.saveChanges"),
            icon: "check",
            primary: true,
            onClick: save,
            flash: joining !== savedJoining || language !== savedLanguage || (savedListed !== null && listed !== savedListed),
          },
          {
            label: t("renameHub"),
            icon: "edit",
            onClick: () => {
              clear();
              setRenaming(true);
            },
          },
        ]}
      />
      <div className="content">
        <Stack gap={16}>
          {note.text ? <StatusLine text={note.text} failed={note.failed} /> : null}
          {renaming ? <RenameHubForm hubId={hubId} onOutcome={renamed} onCancel={() => setRenaming(false)} /> : null}
          <Card title={t("general.hub")}>
            <SettingRows
              rows={[
                {
                  label: t("field.join_mode"),
                  htmlFor: ids.joining,
                  control: control(ids.joining, t("field.join_mode"), joining, joinOptions, pick("joining", setJoining), pending.joining),
                },
                {
                  label: t("setDefaultLanguage"),
                  htmlFor: ids.language,
                  control: control(
                    ids.language,
                    t("setDefaultLanguage"),
                    language,
                    languageOptions,
                    pick("language", setLanguage),
                    pending.language,
                  ),
                },
                ...(savedListed === null
                  ? []
                  : [{ label: t("general.listing"), control: <ListingControl listed={listed} onChange={setListed} /> }]),
              ]}
            />
          </Card>
          <Card title={t("general.appearance")}>
            <SettingRows
              rows={[
                {
                  label: t("general.theme"),
                  control: <ThemePicker value={theme} onChange={setTheme} />,
                },
              ]}
            />
          </Card>
        </Stack>
      </div>
    </>
  );
}
