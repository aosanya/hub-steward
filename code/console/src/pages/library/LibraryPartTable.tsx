import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { byName, matching } from "../../data/listView";
import { type LibraryKind } from "../../data/pages/library";
import { useI18n } from "../../i18n";
import { Card, Detail, Empty, FilterBar, IconButton, Stack, TextLink } from "../../ui";
import { kindSetups, type LibraryEntry } from "./libraryKinds";
import { risksHref } from "../risks/risksLinks";
import { libraryHref } from "./libraryLinks";

type EntryCardProps = { hubId: string; kind: LibraryKind; entry: LibraryEntry; busy: boolean; onDelete: (entry: LibraryEntry) => void };

function EntryCard({ hubId, kind, entry, busy, onDelete }: EntryCardProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const pairs: [string, ReactNode][] = [];
  if (entry.description) pairs.push([t("field.description"), entry.description]);
  if (kind === "consequence")
    pairs.push([
      t("library.relatedHazard"),
      entry.hazardTitle ? <Link to={libraryHref(hubId, "hazard", { open: entry.hazardId })}>{entry.hazardTitle}</Link> : t("library.relatedNone"),
    ]);
  if (kindSetups[kind].guarded)
    pairs.push([
      t("library.relatedBowtie"),
      entry.bowties && entry.bowties.length > 0
        ? entry.bowties.map((bowtie, index) => (
            <span key={bowtie.code}>
              {index > 0 ? ", " : null}
              <Link to={risksHref(hubId, { risk: bowtie.id || bowtie.code })}>{bowtie.title}</Link>
            </span>
          ))
        : t("library.relatedNone"),
    ]);
  return (
    <Card
      title={[entry.code, entry.title].filter(Boolean).join(" · ")}
      open={open}
      onToggle={() => setOpen(!open)}
      actions={
        <>
          <TextLink to={libraryHref(hubId, kind, { open: entry.id })} size="sm">
            {t("edit")}
          </TextLink>
          <IconButton icon="trash" label={t("risks.delete")} danger disabled={busy} onClick={() => onDelete(entry)} />
        </>
      }
    >
      <Detail pairs={pairs} />
    </Card>
  );
}

type LibraryPartTableProps = { hubId: string; kind: LibraryKind; entries: LibraryEntry[]; busy: boolean; onDelete: (entry: LibraryEntry) => void };

export function LibraryPartTable({ hubId, kind, entries, busy, onDelete }: LibraryPartTableProps) {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const listed = byName(matching(entries, (entry) => [entry.title, entry.code, entry.description], search), (entry) => entry.title);
  return (
    <Stack gap={20}>
      <FilterBar placeholder={t(`${kindSetups[kind].pageId}.search`)} chips={[]} search={search} onSearch={setSearch} />
      {listed.length === 0 ? <Empty text={t("noRows")} /> : listed.map((entry) => <EntryCard key={entry.id} hubId={hubId} kind={kind} entry={entry} busy={busy} onDelete={onDelete} />)}
    </Stack>
  );
}
