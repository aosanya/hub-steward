import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import "./searchSelect.css";

export type Choice = { value: string; label: string };

type Props = { label: string; choices: Choice[]; value: string; onChange: (value: string) => void; error?: string };

const Icon = ({ children }: { children: ReactNode }) => (
  <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

const ChevronDown = () => (
  <Icon>
    <path d="m6 9 6 6 6-6" />
  </Icon>
);

const ChevronUp = () => (
  <Icon>
    <path d="m18 15-6-6-6 6" />
  </Icon>
);

const SearchIcon = () => (
  <Icon>
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </Icon>
);

const CheckIcon = () => (
  <Icon>
    <path d="M20 6 9 17l-5-5" />
  </Icon>
);

const containsText = (label: string, query: string) => label.toLowerCase().includes(query.toLowerCase());

export function SearchSelect({ label, choices, value, onChange, error }: Props) {
  const id = useId();
  const labelId = `${id}-label`;
  const valueId = `${id}-value`;
  const listId = `${id}-list`;
  const optionId = (index: number) => `${id}-option-${index}`;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(-1);
  const root = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLButtonElement>(null);
  const entry = useRef<HTMLInputElement>(null);
  const focusBoxOnClose = useRef(false);
  const chosen = choices.find((choice) => choice.value === value);
  const matching = choices.filter((choice) => containsText(choice.label, query));

  const close = (focusBox: boolean) => {
    focusBoxOnClose.current = focusBox;
    setOpen(false);
    setQuery("");
    setActive(-1);
  };

  const choose = (next: string) => {
    onChange(next);
    close(true);
  };

  useEffect(() => {
    if (!open) {
      if (focusBoxOnClose.current) box.current?.focus();
      focusBoxOnClose.current = false;
      return;
    }
    entry.current?.focus();
    const away = (event: Event) => {
      if (!root.current?.contains(event.target as Node)) close(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") return close(true);
    if (event.key === "Tab") return close(false);
    if (event.key === "Enter") {
      event.preventDefault();
      if (matching[active]) choose(matching[active].value);
      return;
    }
    const step = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
    if (step === 0 || matching.length === 0) return;
    event.preventDefault();
    setActive(active === -1 ? (step === 1 ? 0 : matching.length - 1) : (active + step + matching.length) % matching.length);
  };

  const boxClass = error ? "input err" : "input";

  return (
    <div className="field search-select" ref={root}>
      <label className="flabel" id={labelId} htmlFor={id}>
        {label}
      </label>
      {open ? (
        <div className={boxClass}>
          <SearchIcon />
          <input
            ref={entry}
            id={id}
            type="text"
            role="combobox"
            autoComplete="off"
            aria-expanded="true"
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={matching[active] ? optionId(active) : undefined}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(-1);
            }}
            onKeyDown={onKeyDown}
          />
          <ChevronUp />
        </div>
      ) : (
        <button ref={box} id={id} type="button" className={boxClass} aria-haspopup="listbox" aria-expanded="false" aria-labelledby={`${labelId} ${valueId}`} onClick={() => setOpen(true)}>
          <span className="val" id={valueId}>
            {chosen?.label}
          </span>
          <ChevronDown />
        </button>
      )}
      {open ? (
        <div id={listId} className="listbox" role="listbox">
          {matching.map((choice, index) => {
            const on = choice.value === value;
            return (
              <div key={choice.value} id={optionId(index)} role="option" aria-selected={on} className={`lopt${on ? " on" : ""}${index === active ? " active" : ""}`} onClick={() => choose(choice.value)}>
                {choice.label}
                {on ? <CheckIcon /> : null}
              </div>
            );
          })}
        </div>
      ) : null}
      {error ? <p className="ferr">{error}</p> : null}
    </div>
  );
}
