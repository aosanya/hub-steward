import { Chip } from "../ui/Chip";
import { SearchBox } from "../ui/SearchBox";
import "./backlogs.css";

type Props = { query: string; onQuery: (text: string) => void; count?: string; chosen: string[]; onTag: (tag: string) => void; onClear?: () => void };

export function FilterBar({ query, onQuery, count, chosen, onTag, onClear }: Props) {
  return (
    <div className="filter-bar">
      <SearchBox label="Search issues" value={query} onChange={onQuery} />
      {count ? <p className="sub">{count}</p> : null}
      {chosen.length > 0 ? (
        <div className="chosen">
          {chosen.map((tag) => (
            <Chip key={tag} tone="accent" pressed onClick={() => onTag(tag)}>
              {tag} ✕
            </Chip>
          ))}
          {onClear ? (
            <button type="button" className="bb-clear" onClick={onClear}>
              Clear
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
