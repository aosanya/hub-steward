import { useState } from "react";
import { Link } from "react-router-dom";
import { hubPath } from "../api";
import { kindOf, stateOf } from "../data/hubKind";
import { homePageOf, showsPage, viewerOf } from "../data/menu";
import { holdsOnlyPermissions } from "../data/seat";
import { hubWithState, useHubStates } from "../entry/useHubStates";
import { useI18n } from "../i18n";
import type { Hub } from "../types";
import { Badge, Chip, SearchField, initials } from "../ui";
import { Icon } from "../ui/Icon";
import { useDrop } from "./useDrop";

type HubSwitcherProps = { hubs: Hub[]; hub: Hub; page: string };

function HubText({ hub }: { hub: Hub }) {
  const { t } = useI18n();
  const ready = stateOf(hub) === "ready";
  const kind = kindOf(hub);
  return (
    <span className="hub-text">
      <span className="hub-name">{hub.name}</span>
      <span className="hub-meta">
        <span className={ready ? "dot ok" : "dot"} aria-hidden="true" />
        {t(ready ? "hubReady" : "hubSettingUp")}
        {kind === "other" ? null : <Chip kind="mute">{t("hubKind." + kind)}</Chip>}
      </span>
    </span>
  );
}

const pageNamingARole = "agent-edit";
const pageOfOtherHub = (page: string) => (page === pageNamingARole ? "agents" : page);

const pageIn = (hub: Hub, page: string) => {
  const wanted = pageOfOtherHub(page);
  return showsPage(kindOf(hub), wanted, viewerOf(hub)) ? wanted : homePageOf(hub);
};

export function HubSwitcher({ hubs, hub, page }: HubSwitcherProps) {
  const { t } = useI18n();
  const { open, setOpen, root, toggle } = useDrop();
  const [query, setQuery] = useState("");

  const close = () => {
    setOpen(false);
    setQuery("");
  };
  const wanted = query.trim().toLowerCase();
  const shown = hubs.filter((h) => h.id === hub.id || h.name.toLowerCase().includes(wanted));
  const states = useHubStates(open ? hubs.filter((h) => h.id !== hub.id && !holdsOnlyPermissions(h.role, h.permissions)) : []);

  return (
    <div className="switch" ref={root}>
      <button
        type="button"
        ref={toggle}
        className="hub compact"
        title={t("hubSwitcher")}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((now) => !now)}
      >
        <Badge>{initials(hub.name)}</Badge>
        <HubText hub={hub} />
        <Icon name="chevrons" size={16} className="chev" />
      </button>
      {open ? (
        <div className="drop">
          <SearchField placeholder={t("hubFind")} value={query} onChange={setQuery} />
          <div className="hubs">
            <div className="eyebrow">{t("hubYours")}</div>
            {shown.map((h) =>
              h.id === hub.id ? (
                <Link key={h.id} className="hub" to={hubPath(h.id, page)} aria-current="true" onClick={close}>
                  <Badge>{initials(h.name)}</Badge>
                  <HubText hub={h} />
                  <Icon name="check" size={16} stroke={2.6} className="tick" />
                </Link>
              ) : (
                <Link key={h.id} className="hub other" to={hubPath(h.id, pageIn(h, page))} onClick={close}>
                  <Badge>{initials(h.name)}</Badge>
                  <HubText hub={hubWithState(h, states)} />
                  <span className="hub-go">{t("hubOpen")}</span>
                </Link>
              ),
            )}
            <Link className="nav-link" to="/create" onClick={close}>
              <span className="nav-icon new">
                <Icon name="plus" size={14} stroke={2.2} />
              </span>
              {t("hubNew")}
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
