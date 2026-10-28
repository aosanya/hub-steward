import { Link } from "react-router-dom";
import { Icon } from "./Icon";
import type { TileProps, TileState } from "./props";

const marks: Record<TileState, [string, number]> = {
  ok: ["check", 3],
  warn: ["exclaim", 3],
  bad: ["cross", 3],
  mute: ["clock", 2.4],
};

export function Tile({ label, value, state = "ok", to }: TileProps) {
  const [mark, weight] = marks[state];
  const classes = state === "ok" ? "tile" : `tile ${state}`;
  const inner = (
    <>
      <span className="tile-badge">
        <Icon name={mark} size={14} stroke={weight} />
      </span>
      <span className="tile-text">
        <span className="tile-label">{label}</span>
        <span className="tile-value">{value}</span>
      </span>
      {to ? <Icon name="arrow" size={16} stroke={2.2} className="tile-arrow" /> : null}
    </>
  );
  return to ? (
    <Link className={classes} to={to}>
      {inner}
    </Link>
  ) : (
    <div className={classes}>{inner}</div>
  );
}
