import { Link } from "react-router-dom";
import type { CellProps } from "./props";

export function Cell({ text, lead, sub, strong = true, to, title }: CellProps) {
  const name = to ? (
    <Link className="cell-name" to={to} title={title}>
      {text}
    </Link>
  ) : strong ? (
    <span className="cell-name">{text}</span>
  ) : (
    <span>{text}</span>
  );
  return (
    <div className="cell">
      {lead}
      <span className="cell-text">
        {name}
        {sub ? <span className="cell-sub">{sub}</span> : null}
      </span>
    </div>
  );
}
