export type Tab = { path: string; name: string };

export type Tabs = { open: Tab[]; active: string | null };

export const noTabs: Tabs = { open: [], active: null };

export const withoutTab = (tabs: Tabs, path: string): Tabs => {
  const index = tabs.open.findIndex((tab) => tab.path === path);
  if (index < 0) return tabs;
  const open = tabs.open.filter((tab) => tab.path !== path);
  const neighbour = open[index] ?? open[index - 1];
  const active = tabs.active === path ? (neighbour?.path ?? null) : tabs.active;
  return { open, active };
};

export const focusTab = (tabs: Tabs, path: string): Tabs => (tabs.open.some((tab) => tab.path === path) ? { ...tabs, active: path } : tabs);

export const openTab = (tabs: Tabs, tab: Tab): Tabs => {
  if (tabs.open.some((one) => one.path === tab.path)) return focusTab(tabs, tab.path);
  return { open: [...tabs.open, tab], active: tab.path };
};

export const showNoTab = (tabs: Tabs): Tabs => ({ ...tabs, active: null });
