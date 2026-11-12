import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import "./actionsMenu.css";

export type MenuAction = { label: string; onSelect?: () => void; to?: string; current?: boolean; danger?: boolean };

export function ActionsMenu({ actions, label = "Actions", icon }: { actions: MenuAction[]; label?: string; icon?: string }) {
  const [open, setOpen] = useState(false);
  const frame = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (event: MouseEvent) => !frame.current?.contains(event.target as Node) && setOpen(false);
    const escape = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  if (actions.length === 0) return null;
  return (
    <div className="actions" ref={frame}>
      <button type="button" className={icon ? "actions-btn icon" : "actions-btn"} aria-label={icon ? label : undefined} aria-expanded={open} onClick={() => setOpen(!open)}>
        {icon ?? label}
        {icon ? null : <span aria-hidden="true">▾</span>}
      </button>
      {open ? (
        <div className="actions-list">
          {actions.map((action) =>
            action.to !== undefined ? (
              <Link key={action.label} to={action.to} onClick={() => setOpen(false)}>
                {action.label}
              </Link>
            ) : (
              <button
                key={action.label}
                type="button"
                className={action.danger ? "danger" : undefined}
                aria-current={action.current ? "true" : undefined}
                onClick={() => {
                  setOpen(false);
                  action.onSelect?.();
                }}
              >
                {action.label}
              </button>
            ),
          )}
        </div>
      ) : null}
    </div>
  );
}
