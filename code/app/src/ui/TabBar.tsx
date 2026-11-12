import { useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { openAgencyId } from "../agency/open";
import "../chat/unread.css";
import { type InboxClient, mcpInboxClient } from "../inbox/api";
import { type AssignedClient, mcpAssignedClient } from "../inbox/assignedIssues";
import { thingsToDoLabel } from "../inbox/thingsToDo";
import { useNeedsYou } from "../inbox/useNeedsYou";
import { mcpStartClient, type StartClient } from "../coordinator/start/api";
import { Icon } from "./Icon";
import { mainBar, notificationsTab, rememberSide, sideOf, tabPathIn } from "../tabs";

type Props = { inbox?: InboxClient; start?: StartClient; assigned?: AssignedClient };

function useRememberedSide() {
  const side = sideOf(useLocation().pathname);
  useEffect(() => {
    if (side) rememberSide(side);
  }, [side]);
}

export function TabBar({ inbox = mcpInboxClient, start = mcpStartClient, assigned = mcpAssignedClient }: Props) {
  const agencyId = openAgencyId();
  const { count, newsUnread } = useNeedsYou(inbox, start, assigned);
  const things = thingsToDoLabel(count);
  useRememberedSide();
  return (
    <nav className="tabs" aria-label="Main">
      {mainBar.map((tab) => (
        <NavLink key={tab.id} to={tabPathIn(tab, agencyId)} end className="tab">
          <span className="pill">
            <Icon name={tab.icon} />
            {tab.id === notificationsTab.id && things ? (
              <span className="unread-num" aria-label={things.words}>
                {things.shown}
              </span>
            ) : null}
            {tab.id === notificationsTab.id && newsUnread ? <span className="unread-dot" role="img" aria-label="New updates" /> : null}
          </span>
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}
