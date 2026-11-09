import { agencyBasePath, backlogsSegment, doSomethingSegment, homeSegment, ongoingSegment } from "./agency/open";

export type Tab = { id: string; path: string; segment: string; label: string; glyph: string };

export const homeTab: Tab = { id: "home", path: "/", segment: homeSegment, label: "Home", glyph: "⌂" };

export const chatTab: Tab = { id: "chat", path: "/chat", segment: "chat", label: "Chat", glyph: "✉" };

export const doSomethingTab: Tab = { id: "do-something", path: "/do-something", segment: doSomethingSegment, label: "Do Something", glyph: "▦" };

export const startTab: Tab = { ...doSomethingTab, id: "start", label: "Start", glyph: "▶" };

export const ongoingTab: Tab = { id: "ongoing", path: "/ongoing", segment: ongoingSegment, label: "Ongoing", glyph: "◔" };

export const backlogsTab: Tab = { id: "backlogs", path: "/backlogs", segment: backlogsSegment, label: "Backlogs", glyph: "☰" };

export const homeBar: Tab[] = [homeTab, chatTab, doSomethingTab];

export const doSomethingBar: Tab[] = [homeTab, startTab, ongoingTab, backlogsTab];

export const tabs: Tab[] = [homeTab, chatTab, doSomethingTab, ongoingTab];

export const agencyRoute = "/a/:agencyId";

export const retiredStartedRoute = `${agencyRoute}/started`;

export const retiredInboxRoute = `${agencyRoute}/inbox`;

export const tabPathIn = (tab: Tab, agencyId: string) => (agencyId ? `${agencyBasePath(agencyId)}/${tab.segment}` : tab.path);

export const tabRoute = (tab: Tab) => `${agencyRoute}/${tab.segment}`;

const flowSegments = ["join", "start", "steps", "market", "forms"];

const retiredDoSomethingScreens = ["apps", "asks", "supply", "offers", "prices", "stock", "orders", "coordinator", "group-orders", "sell", "buy", "my-orders"];

const tabScreens = [doSomethingSegment, ongoingSegment, backlogsSegment];

const screenOf = (pathname: string) => {
  const [, first = "", , third = ""] = pathname.split("/");
  return first === "a" ? third : first;
};

export const inDoSomething = (pathname: string) => {
  const screen = screenOf(pathname);
  return pathname.startsWith("/a/") ? [...tabScreens, ...flowSegments].includes(screen) : [...tabScreens, ...retiredDoSomethingScreens].includes(screen);
};

export const inFlow = (pathname: string) => inDoSomething(pathname) && !tabScreens.includes(screenOf(pathname));

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
