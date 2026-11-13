export const maxTabs = 8;

export type Tab = { path: string; name: string; folder: boolean };

export type Tabs = { open: Tab[]; active: string | null; used: Record<string, number>; clock: number };

export const noTabs: Tabs = { open: [], active: null, used: {}, clock: 0 };

const touch = (tabs: Tabs, path: string): Tabs => ({ ...tabs, active: path, used: { ...tabs.used, [path]: tabs.clock + 1 }, clock: tabs.clock + 1 });

const unusedLongest = (tabs: Tabs): string => tabs.open.reduce((oldest, tab) => (tabs.used[tab.path] < tabs.used[oldest.path] ? tab : oldest)).path;

export const withoutTab = (tabs: Tabs, path: string): Tabs => {
  const index = tabs.open.findIndex((tab) => tab.path === path);
  if (index < 0) return tabs;
  const open = tabs.open.filter((tab) => tab.path !== path);
  const { [path]: _gone, ...used } = tabs.used;
  const neighbour = open[index] ?? open[index - 1];
  const active = tabs.active === path ? (neighbour?.path ?? null) : tabs.active;
  return { ...tabs, open, active, used };
};

export const focusTab = (tabs: Tabs, path: string): Tabs => (tabs.open.some((tab) => tab.path === path) ? touch(tabs, path) : tabs);

export const openTab = (tabs: Tabs, tab: Tab): Tabs => {
  if (tabs.open.some((one) => one.path === tab.path)) return focusTab(tabs, tab.path);
  const room = tabs.open.length >= maxTabs ? withoutTab(tabs, unusedLongest(tabs)) : tabs;
  return touch({ ...room, open: [...room.open, tab] }, tab.path);
};

export const showNoTab = (tabs: Tabs): Tabs => ({ ...tabs, active: null });
