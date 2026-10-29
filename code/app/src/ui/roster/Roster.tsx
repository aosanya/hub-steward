import { useEffect, useState, type ReactNode } from "react";
import { Button } from "../Button";
import { EmptyCard, LoadFailed } from "../LoadState";
import { Field } from "../Field";
import { ListRow, Rows } from "../ListRow";
import { ROSTER_PAGE_SIZE, usePagedRoster, type RosterLoad } from "./usePagedRoster";
import "./roster.css";

export type RosterRow = { key: string; title: string; meta?: string; end?: ReactNode; onClick?: () => void };

type Props<T> = {
  load: RosterLoad<T>;
  toRow: (item: T) => RosterRow;
  pageSize?: number;
  serverSearch?: boolean;
  searchLabel?: string;
  emptyTitle?: string;
  emptyHint?: string;
};

const SEARCH_DELAY_MS = 300;

const matches = (row: RosterRow, term: string) =>
  [row.title, row.meta ?? "", row.key].some((text) => text.toLowerCase().includes(term));

const useSettled = (value: string, delay: number) => {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return settled;
};

export function Roster<T>({
  load,
  toRow,
  pageSize = ROSTER_PAGE_SIZE,
  serverSearch = false,
  searchLabel = "Search by name",
  emptyTitle = "No one yet",
  emptyHint,
}: Props<T>) {
  const [typed, setTyped] = useState("");
  const settled = useSettled(typed, SEARCH_DELAY_MS);
  const term = typed.trim().toLowerCase();
  const roster = usePagedRoster({ load, pageSize, term: serverSearch ? settled.trim() : "" });
  const rows = roster.items.map(toRow);
  const shown = term && !serverSearch ? rows.filter((row) => matches(row, term)) : rows;

  if (roster.status === "error") {
    return <LoadFailed words="The list could not be loaded." />;
  }

  return (
    <div className="roster">
      {rows.length > 0 || term ? (
        <Field label={searchLabel} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
      ) : null}
      {roster.status === "loading" ? <p className="roster-note" role="status">Loading</p> : null}
      {roster.status === "ready" && rows.length === 0 && !term ? (
        <EmptyCard words={emptyTitle}>
          {emptyHint ? <p>{emptyHint}</p> : null}
        </EmptyCard>
      ) : null}
      {roster.status === "ready" && term && shown.length === 0 && !roster.more ? (
        <p className="roster-note">No one matches “{typed.trim()}”.</p>
      ) : null}
      {shown.length > 0 ? (
        <Rows>
          {shown.map((row) => (
            <ListRow key={row.key} title={row.title} meta={row.meta} end={row.end} onClick={row.onClick} />
          ))}
        </Rows>
      ) : null}
      {roster.moreFailed ? <p className="roster-note">More could not be loaded.</p> : null}
      {roster.more ? (
        <Button onClick={roster.showMore} disabled={roster.loadingMore}>
          {roster.loadingMore ? "Loading" : "Show more"}
        </Button>
      ) : null}
    </div>
  );
}
