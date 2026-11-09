import { useEffect } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { openAgencyId } from "../agency/open";
import { type AgencyClient, mcpAgencyClient } from "../agency/modules";
import { useLoad } from "../forms/useLoad";
import "../chat/unread.css";
import { type InboxClient, mcpInboxClient } from "../inbox/api";
import { unreadOf, useNotifications } from "../inbox/useNotifications";
import { unreadLabel } from "../chat/unread";
import { mcpStartClient, type StartClient } from "../coordinator/start/api";
import { useStartWaiting } from "../coordinator/start/startWaiting";
import { backlogsTab, doSomethingBar, homeBar, inDoSomething, inFlow, rememberSide, sideOf, sideReached, sideTab, tabPathIn, type Tab } from "../tabs";

type Props = { inbox?: InboxClient; start?: StartClient; agency?: AgencyClient };

const taskModule = "taskmanager";

type BarProps = { items: Tab[]; badge?: { id: string; label: string }; current?: string; reserve?: boolean };

function Bar({ items, badge, current, reserve }: BarProps) {
  const agencyId = openAgencyId();
  return (
    <nav className={reserve ? "tabs reserve" : "tabs"} aria-label="Main">
      {items.map((tab) => {
        const inside = (
          <>
            <span className="pill">
              <span aria-hidden="true">{tab.glyph}</span>
              {badge?.id === tab.id && badge.label ? (
                <span className="unread-num" aria-label={`${badge.label} unread notifications`}>
                  {badge.label}
                </span>
              ) : null}
            </span>
            {tab.label}
          </>
        );
        return tab.id === current ? (
          <Link key={tab.id} to={tabPathIn(tab, agencyId)} aria-current="page" className="tab">
            {inside}
          </Link>
        ) : (
          <NavLink key={tab.id} to={tabPathIn(tab, agencyId)} end={tab.id !== backlogsTab.id} className="tab">
            {inside}
          </NavLink>
        );
      })}
    </nav>
  );
}

function HomeBar({ inbox, start }: { inbox: InboxClient; start: StartClient }) {
  const waiting = useStartWaiting(start) ?? [];
  const unread = unreadLabel(unreadOf(useNotifications(inbox).items).length + waiting.length);
  return <Bar items={homeBar} badge={{ id: "inbox", label: unread }} />;
}

const taskModuleKnown = new Map<string, boolean>();

export const forgetTaskModules = () => taskModuleKnown.clear();

function useBacklogsTab(agency: AgencyClient) {
  const agencyId = openAgencyId();
  const read = useLoad(() => agency.read(), `bar-agency:${agencyId}`);
  const found = read.state === "ready" && !read.data.modulesUnread ? read.data.modules.some((module) => module.code === taskModule) : undefined;
  useEffect(() => {
    if (found === undefined) {
      if (read.state !== "loading") taskModuleKnown.delete(agencyId);
      return;
    }
    taskModuleKnown.set(agencyId, found);
  }, [read.state, found, agencyId]);
  if (read.state !== "loading") return { shown: found === true, pending: false };
  const remembered = taskModuleKnown.get(agencyId);
  return { shown: remembered === true, pending: remembered === undefined };
}

function DoSomethingBar({ agency }: { agency: AgencyClient }) {
  const { pathname } = useLocation();
  const side = sideOf(pathname);
  useEffect(() => {
    if (side) rememberSide(side);
  }, [side]);
  const backlogs = useBacklogsTab(agency);
  const current = inFlow(pathname) ? sideTab(sideReached()).id : undefined;
  return <Bar items={doSomethingBar.filter((tab) => tab.id !== backlogsTab.id || backlogs.shown)} current={current} reserve={backlogs.pending} />;
}

export function TabBar({ inbox = mcpInboxClient, start = mcpStartClient, agency = mcpAgencyClient }: Props) {
  const { pathname } = useLocation();
  return inDoSomething(pathname) ? <DoSomethingBar agency={agency} /> : <HomeBar inbox={inbox} start={start} />;
}
