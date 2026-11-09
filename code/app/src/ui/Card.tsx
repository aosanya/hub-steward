import { useId, useState, type ReactNode } from "react";
import "./card.css";

type Props = {
  children: ReactNode;
  empty?: boolean;
  title?: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
};

export function Card({ children, empty = false, title, collapsible = false, defaultOpen = true }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();
  const className = empty ? "card empty" : "card";
  if (title === undefined) return <section className={className}>{children}</section>;
  const shown = !collapsible || open;
  return (
    <section className={className}>
      {collapsible ? (
        <button type="button" className={open ? "card-head" : "card-head closed"} aria-expanded={open} aria-controls={bodyId} onClick={() => setOpen(!open)}>
          <span className="card-title">{title}</span>
          <span className="card-chevron" aria-hidden="true">⌄</span>
        </button>
      ) : (
        <div className="card-head">
          <span className="card-title">{title}</span>
        </div>
      )}
      {shown ? <div id={bodyId} className="card-body">{children}</div> : null}
    </section>
  );
}
