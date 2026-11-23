import { useEffect, type MouseEvent } from "react";
import { NavLink, useLocation, useNavigate, type NavigateFunction } from "react-router-dom";
import { openAgencyId } from "../shared/wakala/openAgency";
import "../features/chat/unread.css";
import { type InboxClient, mcpInboxClient } from "../features/inbox/api";
import { type AssignedClient, mcpAssignedClient } from "../features/inbox/assignedIssues";
import { thingsToDoLabel } from "../features/inbox/thingsToDo";
import { useNeedsYou } from "../features/inbox/useNeedsYou";
import { mcpStartClient, type StartClient } from "../features/market/start/api";
import { useLanguage } from "../shared/language/language";
import { Icon } from "../shared/ui/Icon";
import { carriedChatAbout, carryChatAbout } from "./chatAbout";
import { routes } from "./routes";
import { chatTab, homeTab, mainBar, notificationsTab, rememberSide, sideOf, tabPathIn } from "./tabs";

type Props = { inbox?: InboxClient; start?: StartClient; assigned?: AssignedClient };

function useRememberedSide() {
  const side = sideOf(useLocation().pathname);
  useEffect(() => {
    if (side) rememberSide(side);
  }, [side]);
}

const openChat = (navigate: NavigateFunction) => (event: MouseEvent<HTMLAnchorElement>) => {
  carryChatAbout();
  if (!carriedChatAbout()) return;
  event.preventDefault();
  navigate(routes.assistant.path());
};

export function TabBar({ inbox = mcpInboxClient, start = mcpStartClient, assigned = mcpAssignedClient }: Props) {
  const agencyId = openAgencyId();
  const { words } = useLanguage();
  const { count, newsUnread } = useNeedsYou(inbox, start, assigned);
  const things = thingsToDoLabel(count);
  useRememberedSide();
  const navigate = useNavigate();
  return (
    <nav className="tabs" aria-label="Main">
      {mainBar.map((tab) => (
        <NavLink key={tab.id} to={tabPathIn(tab, agencyId)} end className="tab" onClick={tab.id === chatTab.id ? openChat(navigate) : undefined}>
          <span className="pill">
            <Icon name={tab.icon} />
            {tab.id === notificationsTab.id && things ? (
              <span className="unread-num" aria-label={things.words}>
                {things.shown}
              </span>
            ) : null}
            {tab.id === notificationsTab.id && newsUnread ? <span className="unread-dot" role="img" aria-label="New updates" /> : null}
          </span>
          {tab.id === homeTab.id ? words.tabHome : tab.label}
        </NavLink>
      ))}
    </nav>
  );
}
