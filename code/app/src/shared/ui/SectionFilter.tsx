import { isValidElement, useState, type ReactNode } from "react";
import { sectionLimit } from "./sectionLimit";
import { SearchBox } from "./SearchBox";

type RowLook = { title?: unknown; status?: unknown };

const lookOf = (row: ReactNode): { title: string; status: string } => {
  const props: RowLook = isValidElement<RowLook>(row) ? row.props : {};
  return { title: typeof props.title === "string" ? props.title : "", status: typeof props.status === "string" ? props.status : "" };
};

const all = "All";

export function useSectionFilter(word: string, rows: ReactNode[], active: boolean) {
  const [tab, setTab] = useState(all);
  const [query, setQuery] = useState("");
  const looks = rows.map(lookOf);
  const statuses = Array.from(new Set(looks.map((look) => look.status).filter(Boolean)));
  const tabs = active && statuses.length > 1 ? [all, ...statuses] : [];
  const searchable = active && rows.length > sectionLimit;
  const needle = query.trim().toLowerCase();
  const kept = rows.filter((_, index) => (tab === all || looks[index].status === tab) && (needle === "" || looks[index].title.toLowerCase().includes(needle)));
  const countOf = (name: string) => (name === all ? rows.length : looks.filter((look) => look.status === name).length);
  const reset = () => {
    setTab(all);
    setQuery("");
  };
  const filtering = tabs.length > 0 || searchable;
  const tools = filtering ? (
    <div className="sec-tools">
      {tabs.length > 0 ? (
        <div className="sec-tabs" role="tablist" aria-label={`${word} by status`}>
          {tabs.map((name) => (
            <button key={name} type="button" role="tab" aria-selected={name === tab} onClick={() => setTab(name)}>
              {name}
              <span className="count">{countOf(name)}</span>
            </button>
          ))}
        </div>
      ) : null}
      {searchable ? <SearchBox label={`Search ${word.toLowerCase()}`} value={query} onChange={setQuery} /> : null}
      <span className="sec-count">{`${kept.length} of ${rows.length}`}</span>
    </div>
  ) : null;
  const noMatch = filtering && kept.length === 0 ? (
    <div className="row empty-row">
      <span className="words">No match</span>
      <button type="button" className="sec-act" onClick={reset}>Show all</button>
    </div>
  ) : null;
  return { kept: filtering ? kept : rows, tools, noMatch };
}
