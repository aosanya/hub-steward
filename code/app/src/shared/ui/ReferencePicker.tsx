import { useEffect, useId, useRef, useState } from "react";
import { ListRow } from "./ListRow";
import { SearchBox } from "./SearchBox";
import { ChevronDown, type Choice } from "./SearchSelect";
import "./referencePicker.css";

type Props = { label: string; choices: Choice[]; value: string; onChange: (value: string) => void; error?: string };

const containsText = (label: string, query: string) => label.toLowerCase().includes(query.toLowerCase());

const chosenMark = "✓";

export function ReferencePicker({ label, choices, value, onChange, error }: Props) {
  const id = useId();
  const labelId = `${id}-label`;
  const valueId = `${id}-value`;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const opener = useRef<HTMLButtonElement>(null);
  const reopened = useRef(false);
  const chosen = choices.find((choice) => choice.value === value);
  const matching = choices.filter((choice) => containsText(choice.label, query));

  const close = () => {
    reopened.current = true;
    setOpen(false);
    setQuery("");
  };

  useEffect(() => {
    if (!open && reopened.current) opener.current?.focus();
  }, [open]);

  const choose = (next: string) => {
    onChange(next);
    close();
  };

  return (
    <div className="field reference-picker">
      <span className="flabel" id={labelId}>{label}</span>
      <button ref={opener} id={id} type="button" className={error ? "input err" : "input"} aria-haspopup="dialog" aria-labelledby={`${labelId} ${valueId}`} onClick={() => setOpen(true)}>
        <span className="val" id={valueId}>{chosen?.label}</span>
        <ChevronDown />
      </button>
      {error ? <p className="ferr">{error}</p> : null}
      {open ? (
        <div className="reference-list" role="dialog" aria-label={label}>
          <div className="reference-head">
            <button type="button" className="reference-back" onClick={close}>Back</button>
            <h2 className="reference-title">{label}</h2>
          </div>
          <div className="reference-search">
            <SearchBox label="Search" value={query} onChange={setQuery} />
          </div>
          <div className="reference-rows" role="listbox" aria-label={label}>
            {choices.length === 0 ? <p className="reference-empty">Nothing to choose from yet.</p> : null}
            {choices.length > 0 && matching.length === 0 ? <p className="reference-empty">No match.</p> : null}
            {matching.map((choice) => {
              const on = choice.value === value;
              return (
                <div key={choice.value} role="option" aria-selected={on} tabIndex={0} className={on ? "reference-row on" : "reference-row"} onClick={() => choose(choice.value)} onKeyDown={(event) => (event.key === "Enter" || event.key === " ") && choose(choice.value)}>
                  <ListRow title={choice.label} end={on ? chosenMark : "›"} />
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
