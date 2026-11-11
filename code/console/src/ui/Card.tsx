import { Icon } from "./Icon";
import type { CardProps } from "./props";

export function Card({ title, actions, footer, tight, className, open = true, onToggle, children }: CardProps) {
  const classes = ["card", tight ? "tight" : "", open ? "" : "closed", className ?? ""].filter(Boolean).join(" ");
  const heading = onToggle ? (
    <button type="button" className="card-toggle" aria-expanded={open} onClick={onToggle}>
      <Icon name="chevron-down" size={16} />
      {title}
    </button>
  ) : (
    title
  );
  const head =
    title || actions ? (
      <div className="card-head">
        {title ? <h2>{heading}</h2> : null}
        {actions ? <div className="card-actions">{actions}</div> : null}
      </div>
    ) : null;
  const Tag = title ? "section" : "div";
  const parted = head !== null || Boolean(footer);
  return (
    <Tag className={classes}>
      {head}
      {open ? parted ? <div className="card-body">{children}</div> : children : null}
      {open && footer ? <div className="card-foot">{footer}</div> : null}
    </Tag>
  );
}
