import { Link } from "react-router-dom";
import { Icon } from "./Icon";
import type { AddTileProps } from "./props";

export function AddTile({ text, to, onClick, note }: AddTileProps) {
  const inner = (
    <>
      <span className="nav-icon new">
        <Icon name="plus" size={14} stroke={2.2} />
      </span>
      {text}
      {note ? <span className="add-note">{note}</span> : null}
    </>
  );
  return to ? (
    <Link className="add" to={to} onClick={onClick}>
      {inner}
    </Link>
  ) : (
    <button type="button" className="add" onClick={onClick}>
      {inner}
    </button>
  );
}
