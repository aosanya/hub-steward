import { useEffect, useMemo, useRef, type MouseEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { hubPath } from "../api";
import type { HubKind } from "../data/hubKind";
import { buildMenu, type MenuRow } from "../data/menu";
import { useI18n } from "../i18n";
import { useSession } from "../session";
import { Icon } from "../ui/Icon";
import { usageSearch } from "../pages/usage/usageLinks";
import type { Badges } from "./page";

type MenuProps = { hubId: string; kind: HubKind; role?: string; page: string; badges: Badges };

type NavRowProps = { hubId: string; row: MenuRow; depth?: number };

function NavRow({ hubId, row, depth = 0 }: NavRowProps) {
  const sub = depth > 0;
  const { t } = useI18n();
  const { pathname, search } = useLocation();
  const link = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    if (row.current) link.current?.scrollIntoView?.({ block: "nearest" });
  }, [row.current]);
  const chevron =
    row.expanded === undefined ? null : (
      <span className="nav-chev">
        <Icon name={row.expanded ? "chevron-down" : "chevron-right"} size={14} stroke={2.2} />
      </span>
    );
  const tail =
    row.badge || chevron ? (
      <span className="nav-end">
        {row.badge ? <span className="nav-badge">{row.badge}</span> : null}
        {chevron}
      </span>
    ) : null;
  return (
    <>
      {row.dividedBefore ? <div className="menu-rule" role="separator" /> : null}
      <Link
        ref={link}
        className={depth > 1 ? "nav-link sub deep" : sub ? "nav-link sub" : "nav-link"}
        to={hubPath(hubId, row.id) + (row.id.startsWith("usage") ? usageSearch(pathname, search) : "")}
        aria-current={row.current ? "page" : undefined}
        aria-expanded={row.expanded}
      >
        <span className="nav-icon page">
          <Icon name={row.icon} size={sub ? 14 : 16} />
        </span>
        {t(row.label)}
        {tail}
      </Link>
      {(row.children ?? []).map((child) => (
        <NavRow key={child.id} hubId={hubId} row={child} depth={depth + 1} />
      ))}
    </>
  );
}

export function Menu({ hubId, kind, role = "", page, badges }: MenuProps) {
  const { t } = useI18n();
  const { signOut } = useSession();
  const navigate = useNavigate();
  const groups = useMemo(() => buildMenu(kind, page, badges, role), [kind, page, badges, role]);

  const leave = (e: MouseEvent) => {
    e.preventDefault();
    signOut().then(() => navigate("/start"));
  };

  return (
    <nav className="side" aria-label={t("menuLabel")}>
      <div className="menu">
        {groups.map((group) => (
          <div key={group.caption ?? "top"} className={group.divided ? "menu-group divided" : "menu-group"}>
            {group.caption ? <div className="eyebrow">{t(group.caption)}</div> : null}
            {group.rows.map((row) => (
              <NavRow key={row.id} hubId={hubId} row={row} />
            ))}
          </div>
        ))}
      </div>
      <div className="side-foot">
        <Link className="nav-link" to="/start" onClick={leave}>
          <span className="nav-icon">
            <Icon name="logout" size={16} />
          </span>
          {t("signOut")}
        </Link>
      </div>
    </nav>
  );
}
