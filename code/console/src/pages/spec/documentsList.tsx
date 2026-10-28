import { useMemo, useState, type ReactNode } from "react";
import { byName } from "../../data/listView";
import { useI18n } from "../../i18n";
import type { PageRow } from "../../types";
import { Button, Card, Chip, Detail, Empty, SearchField, SelectField, Stack, StatusLine, TitleRow, Toolbar } from "../../ui";
import { languageChoices } from "./generalLanguages";

type DocumentsListProps = { rows: PageRow[] | null; note: { text: string; failed: boolean }; onUpload: () => void };

const textOf = (value: unknown) => (value === undefined || value === null ? "" : String(value));

const codesOf = (row: PageRow) =>
  textOf(row.languages)
    .split(",")
    .map((code) => code.trim())
    .filter(Boolean);

type DocumentCardProps = { title: string; languages: string[]; passages: string; updated: string };

function DocumentCard({ title, languages, passages, updated }: DocumentCardProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const pairs: [string, ReactNode][] = [
    [t("documents.languages"), languages.length > 0 ? <Chip kind="ok">{languages.map((code) => code.toUpperCase()).join(" · ")}</Chip> : "—"],
    [t("documents.passages"), passages],
    [t("documents.updated"), updated],
  ];
  return (
    <Card title={title} open={open} onToggle={() => setOpen(!open)}>
      <Detail pairs={pairs} />
    </Card>
  );
}

export function DocumentsList({ rows, note, onUpload }: DocumentsListProps) {
  const { t, lang } = useI18n();
  const [search, setSearch] = useState("");
  const [language, setLanguage] = useState("");

  const dateOf = (value: unknown) => {
    const date = new Date(textOf(value));
    if (Number.isNaN(date.getTime())) return textOf(value);
    return new Intl.DateTimeFormat(lang === "en" ? "en-GB" : lang, { day: "numeric", month: "short" }).format(date);
  };

  const codes = useMemo(() => [...new Set((rows ?? []).flatMap(codesOf))].sort(), [rows]);
  const shown = byName(
    (rows ?? []).filter(
      (row) => textOf(row.document).toLowerCase().includes(search.trim().toLowerCase()) && (!language || codesOf(row).includes(language)),
    ),
    (row) => textOf(row.document),
  );

  const upload = <Button onClick={onUpload}>{t("documents.upload")}</Button>;
  const none = rows !== null && rows.length === 0;

  const body = (): ReactNode => {
    if (rows === null) return <Empty text={t("loadFailed")} failed />;
    if (none) return <Empty text={t("documents.none")} action={upload} />;
    return (
      <Stack gap={20}>
        {note.text ? <StatusLine text={note.text} failed={note.failed} /> : null}
        <Toolbar
          left={
            <>
              <SearchField placeholder={t("documents.search")} value={search} onChange={setSearch} />
              <SelectField
                icon="globe"
                label={t("documents.allLanguages")}
                value={language}
                onChange={setLanguage}
                options={[{ value: "", label: t("documents.allLanguages") }, ...languageChoices(codes)]}
              />
            </>
          }
        />
        {shown.length === 0 ? (
          <Empty text={t("noRows")} />
        ) : (
          shown.map((row, index) => (
            <DocumentCard
              key={textOf(row.document) || String(index)}
              title={textOf(row.document)}
              languages={codesOf(row)}
              passages={textOf(row.passages)}
              updated={dateOf(row.updated)}
            />
          ))
        )}
      </Stack>
    );
  };

  return (
    <>
      <TitleRow title={t("menu.documents")} primary={rows === null || none ? undefined : t("documents.upload")} onPrimary={onUpload} />
      <div className="content">{body()}</div>
    </>
  );
}
