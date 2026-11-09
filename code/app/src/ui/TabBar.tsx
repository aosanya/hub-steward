import { NavLink, useLocation } from "react-router-dom";
import { openAgencyId } from "../agency/open";
import { type AgencyClient, mcpAgencyClient } from "../agency/modules";
import { useLoad } from "../forms/useLoad";
import "../chat/unread.css";
import { type InboxClient, mcpInboxClient } from "../inbox/api";
import { unreadOf, useNotifications } from "../inbox/useNotifications";
import { unreadLabel } from "../chat/unread";
import { mcpStartClient, type StartClient } from "../coordinator/start/api";
import { useStartWaiting } from "../coordinator/start/startWaiting";
import { backlogsTab, doSomethingBar, homeBar, inDoSomething, tabPathIn, type Tab } from "../tabs";

type Props = { inbox?: InboxClient; start?: StartClient; agency?: AgencyClient };

const taskModule = "taskmanager";

function Bar({ items, badge }: { items: Tab[]; badge?: { id: string; label: string } }) {
  const agencyId = openAgencyId();
  return (
    <nav className="tabs" aria-label="Main">
      {items.map((tab) => (
        <NavLink key={tab.id} to={tabPathIn(tab, agencyId)} end={tab.id !== backlogsTab.id} className="tab">
          <span className="pill">
            <span aria-hidden="true">{tab.glyph}</span>
            {badge?.id === tab.id && badge.label ? (
              <span className="unread-num" aria-label={`${badge.label} unread notifications`}>
                {badge.label}
              </span>
            ) : null}
          </span>
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}

function HomeBar({ inbox, start }: { inbox: InboxClient; start: StartClient }) {
  const waiting = useStartWaiting(start) ?? [];
  const unread = unreadLabel(unreadOf(useNotifications(inbox).items).length + waiting.length);
  return <Bar items={homeBar} badge={{ id: "inbox", label: unread }} />;
}

function DoSomethingBar({ agency }: { agency: AgencyClient }) {
  const read = useLoad(() => agency.read(), `bar-agency:${openAgencyId()}`);
  const backlogs = read.state === "ready" && read.data.modules.some((module) => module.code === taskModule);
  return <Bar items={doSomethingBar.filter((tab) => tab.id !== backlogsTab.id || backlogs)} />;
}

export function TabBar({ inbox = mcpInboxClient, start = mcpStartClient, agency = mcpAgencyClient }: Props) {
  const { pathname } = useLocation();
  return inDoSomething(pathname) ? <DoSomethingBar agency={agency} /> : <HomeBar inbox={inbox} start={start} />;
}
