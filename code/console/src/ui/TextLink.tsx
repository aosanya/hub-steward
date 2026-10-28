import { Link } from "react-router-dom";
import { Icon } from "./Icon";
import type { LinkProps } from "./props";

export function TextLink({ to, onClick, arrow, size, className, children }: LinkProps) {
  const classes = ["link", size ?? "", className ?? ""].filter(Boolean).join(" ");
  const mark = arrow ? <Icon name="arrow" size={12} stroke={2.6} /> : null;
  if (to) {
    return (
      <Link to={to} className={classes} onClick={onClick}>
        {children}
        {mark}
      </Link>
    );
  }
  return (
    <button type="button" className={classes} onClick={onClick}>
      {children}
      {mark}
    </button>
  );
}
