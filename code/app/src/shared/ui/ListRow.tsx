import { createContext, useContext, type ReactNode } from "react";
import { Chip, statusTone } from "./Chip";
import { Icon, type IconName } from "./Icon";

type Props = { title: string; code?: string; meta?: string | string[]; end?: ReactNode; onClick?: () => void; lead?: boolean; start?: ReactNode; below?: ReactNode; className?: string; role?: string; pressed?: boolean; status?: string };

const chevron = "›";

export type SectionRowsLook = { plain: boolean; icon?: IconName };

export const SectionRows = createContext<SectionRowsLook | null>(null);

export const leadLetter = (title: string) => Array.from(title.trim()).find((c) => /[\p{L}\p{N}]/u.test(c))?.toLocaleUpperCase() ?? "";

export function ListRow({ title, code, meta, end, onClick, lead, start, below, className, role, pressed, status }: Props) {
  const look = useContext(SectionRows);
  const tiled = lead ?? (look !== null && !look.plain);
  const letter = tiled && !look?.icon ? leadLetter(title) : "";
  const tail = end ?? (status ? <Chip tone={statusTone(status)}>{status}</Chip> : null);
  const rowClass = className ? `row ${className}` : "row";
  const inner = (
    <>
      {start}
      {tiled && (look?.icon || letter) ? <span className="lead" aria-hidden="true">{look?.icon ? <Icon name={look.icon} /> : letter}</span> : null}
      <span className="txt">
        <span className="ttl">{title}</span>
        {code ? <span className="meta code">{code}</span> : null}
        {[meta ?? []].flat().filter(Boolean).map((line, index) => (
          <span key={index} className="meta">{line}</span>
        ))}
        {below}
      </span>
      {tail ? <span className="end" aria-hidden={tail === chevron ? true : undefined}>{tail}</span> : null}
    </>
  );
  return onClick ? (
    <button type="button" role={role} className={rowClass} aria-pressed={pressed} onClick={onClick}>
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

export function Rows({ children, role }: { children: ReactNode; role?: string }) {
  return <div className="rows" role={role}>{children}</div>;
}
