import { agencyBasePath, doSomethingSegment } from "./agency/open";

export type Tab = { id: string; path: string; segment: string; label: string; glyph: string };

export const chatTab: Tab = { id: "chat", path: "/chat", segment: "chat", label: "Chat", glyph: "✉" };

export const doSomethingTab: Tab = { id: "do-something", path: "/", segment: doSomethingSegment, label: "Do Something", glyph: "⌂" };

export const tabs: Tab[] = [
  doSomethingTab,
  chatTab,
  { id: "inbox", path: "/inbox", segment: "inbox", label: "Inbox", glyph: "▤" },
];

export const agencyRoute = "/a/:agencyId";

export const retiredStartedRoute = `${agencyRoute}/started`;

export const tabPathIn = (tab: Tab, agencyId: string) => (agencyId ? `${agencyBasePath(agencyId)}/${tab.segment}` : tab.path);

export const tabRoute = (tab: Tab) => `${agencyRoute}/${tab.segment}`;
