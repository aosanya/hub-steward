import type { IconName } from "./ui/Icon";
import { agencyBasePath, backlogsSegment, doSomethingSegment, homeSegment, notificationsSegment, ongoingSegment } from "./agency/open";

export type Tab = { id: string; path: string; segment: string; label: string; icon: IconName };

export const homeTab: Tab = { id: "home", path: "/", segment: homeSegment, label: "Home", icon: "home" };

export const chatTab: Tab = { id: "chat", path: "/chat", segment: "chat", label: "Chat", icon: "chat" };

export const notificationsTab: Tab = { id: "notifications", path: "/notifications", segment: notificationsSegment, label: "Notifications", icon: "bell" };

export const startTab: Tab = { id: "start", path: "/do-something", segment: doSomethingSegment, label: "Start", icon: "play" };

export const ongoingTab: Tab = { id: "ongoing", path: "/ongoing", segment: ongoingSegment, label: "Ongoing", icon: "clock" };

export const backlogsTab: Tab = { id: "backlogs", path: "/backlogs", segment: backlogsSegment, label: "Backlogs", icon: "list" };

export const mainBar: Tab[] = [homeTab, chatTab, notificationsTab];

export const tabs: Tab[] = [homeTab, chatTab, notificationsTab, startTab, ongoingTab];

export const agencyRoute = "/a/:agencyId";

export const retiredStartedRoute = `${agencyRoute}/started`;

export const retiredInboxRoute = `${agencyRoute}/inbox`;

export const tabPathIn = (tab: Tab, agencyId: string) => (agencyId ? `${agencyBasePath(agencyId)}/${tab.segment}` : tab.path);

export const tabRoute = (tab: Tab) => `${agencyRoute}/${tab.segment}`;

const screenOf = (pathname: string) => {
  const [, first = "", , third = ""] = pathname.split("/");
  return first === "a" ? third : first;
};

export type Side = "start" | "ongoing";

let reached: Side = "start";

export const sideReached = () => reached;

export const sideOf = (pathname: string): Side | undefined => {
  const screen = screenOf(pathname);
  if (screen === doSomethingSegment) return "start";
  if (screen === ongoingSegment) return "ongoing";
  return undefined;
};

export const rememberSide = (side: Side) => {
  reached = side;
};

export const sideTab = (side: Side) => (side === "ongoing" ? ongoingTab : startTab);
