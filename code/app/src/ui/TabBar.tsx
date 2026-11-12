import { useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { openAgencyId } from "../agency/open";
import "../chat/unread.css";
import { type InboxClient, mcpInboxClient } from "../inbox/api";
import { unreadOf, useNotifications } from "../inbox/useNotifications";
import { unreadLabel } from "../chat/unread";
import { mcpStartClient, type StartClient } from "../coordinator/start/api";
import { useStartWaiting } from "../coordinator/start/startWaiting";
import { Icon } from "./Icon";
import { mainBar, notificationsTab, rememberSide, sideOf, tabPathIn } from "../tabs";

type Props = { inbox?: InboxClient; start?: StartClient };

function useRememberedSide() {
  const side = sideOf(useLocation().pathname);
  useEffect(() => {
    if (side) rememberSide(side);
  }, [side]);
}

export function TabBar({ inbox = mcpInboxClient, start = mcpStartClient }: Props) {
  const agencyId = openAgencyId();
  const waiting = useStartWaiting(start) ?? [];
  const unread = unreadLabel(unreadOf(useNotifications(inbox).items).length + waiting.length);
  useRememberedSide();
  return (
    <nav className="tabs" aria-label="Main">
      {mainBar.map((tab) => (
        <NavLink key={tab.id} to={tabPathIn(tab, agencyId)} end className="tab">
          <span className="pill">
            <Icon name={tab.icon} />
            {tab.id === notificationsTab.id && unread ? (
              <span className="unread-num" aria-label={`${unread} unread notifications`}>
                {unread}
              </span>
            ) : null}
          </span>
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}
