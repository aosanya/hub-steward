import type { ReactNode } from "react";

type Props = { title: string; meta?: string | string[]; end?: ReactNode; onClick?: () => void; lead?: boolean; start?: ReactNode; className?: string; role?: string };

const chevron = "›";

export const leadLetter = (title: string) => Array.from(title.trim()).find((c) => /[\p{L}\p{N}]/u.test(c))?.toLocaleUpperCase() ?? "";

export function ListRow({ title, meta, end, onClick, lead, start, className, role }: Props) {
  const letter = lead ? leadLetter(title) : "";
  const rowClass = className ? `row ${className}` : "row";
  const inner = (
    <>
      {start}
      {letter ? <span className="lead" aria-hidden="true">{letter}</span> : null}
      <span className="txt">
        <span className="ttl">{title}</span>
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

export function Rows({ children }: { children: ReactNode }) {
  return <div className="rows">{children}</div>;
}
