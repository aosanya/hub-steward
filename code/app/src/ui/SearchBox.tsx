import { SearchIcon } from "./SearchSelect";

type Props = { label: string; value: string; onChange: (value: string) => void };

export function SearchBox({ label, value, onChange }: Props) {
  return (
    <div className="input search-box">
      <SearchIcon />
      <input type="search" aria-label={label} placeholder={label} value={value} onChange={(event) => onChange(event.target.value)} />
      {value ? (
        <button type="button" className="search-clear" aria-label="Clear search" onClick={() => onChange("")}>
          ×
        </button>
      ) : null}
    </div>
  );
}
