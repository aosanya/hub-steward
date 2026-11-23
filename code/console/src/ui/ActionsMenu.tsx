import { Fragment, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "../i18n";
import { Icon } from "./Icon";
import type { HeaderAction } from "./props";

const rankOf = (action: HeaderAction) => (action.danger ? 2 : action.primary ? 0 : 1);

export const inMenuOrder = (actions: HeaderAction[]) =>
  actions.map((action, index) => ({ action, index })).sort((a, b) => rankOf(a.action) - rankOf(b.action) || a.index - b.index).map(({ action }) => action);

type Landing = "first" | "last";

function Item({ action, onPick }: { action: HeaderAction; onPick: (action: HeaderAction, link: boolean) => void }) {
  const className = ["actions-item", action.primary ? "primary" : "", action.danger ? "danger" : ""].filter(Boolean).join(" ");
  const mark = action.busy ? <span className="tool-spin" aria-hidden="true" /> : <Icon name={action.icon} size={16} stroke={2.2} />;
  if (action.to && !action.disabled && !action.busy) {
    return (
      <Link to={action.to} className={className} role="menuitem" onClick={() => onPick(action, true)}>
        {mark}
        {action.label}
      </Link>
    );
  }
  return (
    <button
      type="button"
      className={className}
      role="menuitem"
      disabled={action.disabled || action.busy}
      aria-busy={action.busy || undefined}
      onClick={() => onPick(action, false)}
    >
      {mark}
      {action.label}
    </button>
  );
}

export function ActionsMenu({ actions }: { actions: HeaderAction[] }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const landing = useRef<Landing | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const items = inMenuOrder(actions);
  const flash = actions.some((action) => action.primary && action.flash);

  const enabled = () => Array.from(root.current?.querySelectorAll<HTMLElement>(".actions-item:not(:disabled)") ?? []);

  useEffect(() => {
    if (!open) return;
    const away = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [open]);

  useEffect(() => {
    if (!open || landing.current === null) return;
    const all = enabled();
    (landing.current === "first" ? all[0] : all[all.length - 1])?.focus();
    landing.current = null;
  }, [open]);

  const pick = (action: HeaderAction, link: boolean) => {
    setOpen(false);
    action.onClick?.();
    if (!link) toggle.current?.focus();
  };

  const target = (key: string, count: number, at: number) => {
    if (key === "Home") return 0;
    if (key === "End") return count - 1;
    if (key === "ArrowDown") return at === -1 ? 0 : (at + 1) % count;
    return at === -1 ? count - 1 : (at - 1 + count) % count;
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape" && open) {
      setOpen(false);
      toggle.current?.focus();
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    if (!open) {
      landing.current = event.key === "ArrowUp" || event.key === "End" ? "last" : "first";
      setOpen(true);
      return;
    }
    const all = enabled();
    if (all.length === 0) return;
    all[target(event.key, all.length, all.indexOf(document.activeElement as HTMLElement))].focus();
  };

  return (
    <div className="actions" ref={root} onKeyDown={onKeyDown}>
      <button
        type="button"
        ref={toggle}
        className={flash ? "btn quiet flash" : "btn quiet"}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((now) => !now)}
      >
        {t("actions")}
        <Icon name="chevron-down" size={14} stroke={2} />
      </button>
      {open ? (
        <div className="actions-menu" role="menu" aria-label={t("actions")}>
          {items.map((action, index) => (
            <Fragment key={action.label}>
              {action.danger && (index === 0 || !items[index - 1].danger) ? <div className="actions-rule" role="separator" /> : null}
              <Item action={action} onPick={pick} />
            </Fragment>
          ))}
        </div>
      ) : null}
    </div>
  );
}
