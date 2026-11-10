import type { ReactNode } from "react";

type Props = { title: string; code?: string; meta?: string | string[]; end?: ReactNode; onClick?: () => void; lead?: boolean; start?: ReactNode; className?: string; role?: string };

const chevron = "›";

export const leadLetter = (title: string) => Array.from(title.trim()).find((c) => /[\p{L}\p{N}]/u.test(c))?.toLocaleUpperCase() ?? "";

export function ListRow({ title, code, meta, end, onClick, lead, start, className, role }: Props) {
  const letter = lead ? leadLetter(title) : "";
  const rowClass = className ? `row ${className}` : "row";
  const inner = (
    <>
      {start}
      {letter ? <span className="lead" aria-hidden="true">{letter}</span> : null}
      <span className="txt">
        <span className="ttl">{title}</span>
        {code ? <span className="meta code">{code}</span> : null}
        {[meta ?? []].flat().filter(Boolean).map((line, index) => (
          <span key={index} className="meta">{line}</span>
        ))}
      </span>
      {end ? <span className="end" aria-hidden={end === chevron ? true : undefined}>{end}</span> : null}
    </>
  );
  return onClick ? (
    <button type="button" role={role} className={rowClass} onClick={onClick}>
      {inner}
    </button>
  ) : (
    <div role={role} className={rowClass}>{inner}</div>
  );
}

export type Selection = { checked: boolean; onChange: (checked: boolean) => void; label: string };

export function SelectionBox({ selection }: { selection: Selection | null }) {
  return selection ? (
    <input type="checkbox" aria-label={selection.label} checked={selection.checked} onChange={(event) => selection.onChange(event.target.checked)} />
  ) : (
    <span className="selgap" aria-hidden="true" />
  );
}

export function SelectableRow({ selection, ...row }: Props & { selection: Selection | null }) {
  return (
    <div className="selrow">
      <SelectionBox selection={selection} />
      <ListRow {...row} />
    </div>
  );
}

export function Rows({ children }: { children: ReactNode }) {
  return <div className="rows">{children}</div>;
}
