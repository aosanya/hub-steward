import type { HubKind } from "./hubKind";
import { isStaff } from "./seat";

export type Badges = Record<string, number>;

export type MenuRow = {
  id: string;
  label: string;
  icon: string;
  badge?: number;
  current?: boolean;
  expanded?: boolean;
  dividedBefore?: boolean;
  children?: MenuRow[];
};

export type MenuGroup = { caption?: string; divided: boolean; rows: MenuRow[] };

export type ChipWords = { step?: string };

export type Crumbs = { section?: string; parent?: string; last: string };

type Section =
  | "agency"
  | "usersAgents"
  | "generated"
  | "knowledge"
  | "settings";

type Entry = {
  id: string;
  icon: string;
  section: Section | null;
  kinds: HubKind[];
  children?: string[];
  dividedBefore?: boolean;
  managersOnly?: boolean;
};

export const hiddenPages: string[] = ["network"];

const everyKind: HubKind[] = ["lab", "farmers", "riders"];
const labAndRiders: HubKind[] = ["lab", "riders"];
const farmersOnly: HubKind[] = ["farmers"];

export const reviewAreaPages = [
  "review-profile",
  "review-goals",
  "review-objectives",
  "review-roles",
  "review-workflows",
  "review-risks",
  "review-tests",
];

const sectionCaptions: Record<Section, string> = {
  agency: "menuAgency",
  usersAgents: "menuUsersAgents",
  generated: "menuGenerated",
  knowledge: "menuKnowledge",
  settings: "menuSettings",
};

const entries: Entry[] = [
  { id: "status", icon: "pulse", section: null, kinds: everyKind },
  { id: "profile", icon: "doc", section: "agency", kinds: everyKind },
  { id: "goals", icon: "target", section: "agency", kinds: everyKind },
  { id: "objectives", icon: "flag", section: "agency", kinds: farmersOnly },
  { id: "roles", icon: "people", section: "agency", kinds: everyKind },
  { id: "workflows", icon: "sliders", section: "agency", kinds: everyKind },
  { id: "test", icon: "clipboard", section: "agency", kinds: farmersOnly },
  {
    id: "risks",
    icon: "shield",
    section: "agency",
    kinds: everyKind,
    children: ["bowties", "hazards", "threats", "consequences", "controls"],
  },
  { id: "bowties", icon: "grid", section: "agency", kinds: everyKind },
  { id: "hazards", icon: "grid", section: "agency", kinds: everyKind },
  { id: "threats", icon: "grid", section: "agency", kinds: everyKind },
  { id: "consequences", icon: "grid", section: "agency", kinds: everyKind },
  { id: "controls", icon: "shield", section: "agency", kinds: everyKind },
  { id: "modules", icon: "package", section: "agency", kinds: everyKind },
  {
    id: "publish-review",
    icon: "eye",
    section: "agency",
    kinds: everyKind,
    dividedBefore: true,
    children: reviewAreaPages,
  },
  { id: "review-profile", icon: "doc", section: "agency", kinds: everyKind },
  { id: "review-goals", icon: "target", section: "agency", kinds: everyKind },
  {
    id: "review-objectives",
    icon: "flag",
    section: "agency",
    kinds: farmersOnly,
  },
  { id: "review-roles", icon: "people", section: "agency", kinds: everyKind },
  {
    id: "review-workflows",
    icon: "sliders",
    section: "agency",
    kinds: everyKind,
  },
  { id: "review-risks", icon: "shield", section: "agency", kinds: everyKind },
  {
    id: "review-tests",
    icon: "clipboard",
    section: "agency",
    kinds: everyKind,
  },
  { id: "publish", icon: "send", section: "agency", kinds: everyKind },
  { id: "users", icon: "people", section: "usersAgents", kinds: everyKind },
  { id: "groups", icon: "chat", section: "usersAgents", kinds: everyKind },
  { id: "agents", icon: "robot", section: "usersAgents", kinds: everyKind },
  { id: "approvals", icon: "check", section: "generated", kinds: labAndRiders },
  {
    id: "operations",
    icon: "activity",
    section: "generated",
    kinds: labAndRiders,
    children: ["network", "activity", "alerts"],
  },
  { id: "network", icon: "wifi", section: "generated", kinds: labAndRiders },
  { id: "activity", icon: "pulse", section: "generated", kinds: labAndRiders },
  { id: "alerts", icon: "alert", section: "generated", kinds: labAndRiders },
  { id: "equipment", icon: "laptop", section: "generated", kinds: ["riders"] },
  { id: "documents", icon: "file", section: "knowledge", kinds: labAndRiders },
  { id: "general", icon: "gear", section: "settings", kinds: everyKind },
  { id: "consent", icon: "doc", section: "settings", kinds: everyKind, managersOnly: true },
  {
    id: "models",
    icon: "grid",
    section: "settings",
    kinds: everyKind,
    children: ["models-configure", "assistant", "usage"],
  },
  { id: "models-configure", icon: "gear", section: "settings", kinds: everyKind },
  { id: "assistant", icon: "robot", section: "settings", kinds: everyKind, managersOnly: true },
  {
    id: "usage",
    icon: "chart",
    section: "settings",
    kinds: everyKind,
    managersOnly: true,
    children: ["usage-overview", "usage-work", "usage-agents"],
  },
  { id: "usage-overview", icon: "chart", section: "settings", kinds: everyKind, managersOnly: true },
  { id: "usage-work", icon: "grid", section: "settings", kinds: everyKind, managersOnly: true },
  { id: "usage-agents", icon: "people", section: "settings", kinds: everyKind, managersOnly: true },
];

const details = new Map([
  [
    "agent-edit",
    { icon: "robot", parent: "agents", section: "usersAgents" as const },
  ],
  [
    "workflow-edit",
    { icon: "sliders", parent: "workflows", section: "agency" as const },
  ],
]);

const agencyPagesApartFromContent = [
  "test",
  "publish",
  "publish-review",
  ...reviewAreaPages,
];

const agencyContentPages = entries
  .filter(
    (entry) =>
      entry.section === "agency" &&
      !agencyPagesApartFromContent.includes(entry.id),
  )
  .map((entry) => entry.id);

export const isAgencyContentPage = (page: string): boolean =>
  agencyContentPages.includes(page);

const childIds = new Set(entries.flatMap((entry) => entry.children ?? []));

const entryOf = (id: string) => entries.find((entry) => entry.id === id);

const parentOf = (id: string) =>
  entries.find((entry) => entry.children?.includes(id));

const hasDescendant = (entry: Entry, id: string): boolean =>
  (entry.children ?? []).some(
    (kid) => kid === id || hasDescendant(entryOf(kid)!, id),
  );

const shownTo =
  (kind: HubKind, role = "") =>
  (entry: Entry | undefined): entry is Entry =>
    entry !== undefined &&
    entry.kinds.includes(kind) &&
    !hiddenPages.includes(entry.id) &&
    !(entry.managersOnly && isStaff(role));

export const pageIcon = (page: string): string =>
  entryOf(page)?.icon ?? details.get(page)?.icon ?? "chat";

export const showsPage = (kind: HubKind, page: string): boolean =>
  shownTo(kind)(entryOf(page));

export const pagesOf = (kind: HubKind): string[] =>
  entries.filter(shownTo(kind)).map((entry) => entry.id);

const modelsLanding = new Map([["models", "models-configure"]]);

const usageHints = () => ["chat.usage.1", "chat.usage.2", "chat.usage.3"];

const ownHints = new Map<string, (words: ChipWords) => string[]>([
  ["usage", usageHints],
  ["usage-overview", usageHints],
  ["usage-work", usageHints],
  ["usage-agents", usageHints],
  [
    "workflow-edit",
    (words) => [
      "chat.workflow-edit.1",
      ...(words.step ? ["chat.workflow-edit.2"] : []),
    ],
  ],
]);

const hintOwnerOf = (page: string): string =>
  details.get(page)?.parent ??
  (page === "models-configure" || page === "assistant" ? "models" : undefined) ??
  (reviewAreaPages.includes(page) ? "publish-review" : page);

export const hintKeys = (
  page: string,
  hubHasModels = true,
  words: ChipWords = {},
): string[] => {
  const own = ownHints.get(page);
  if (own) return own(words);
  const owner = hintOwnerOf(page);
  if (!entryOf(owner) || hiddenPages.includes(owner)) return [];
  const count = !hubHasModels && owner === "models" ? 1 : 3;
  return Array.from(
    { length: count },
    (_, index) => `chat.${owner}.${index + 1}`,
  );
};

export function crumbsOf(page: string): Crumbs {
  const entry = entryOf(page);
  if (entry) {
    const parent = parentOf(page);
    return {
      section: entry.section ? sectionCaptions[entry.section] : undefined,
      parent: parent?.id,
      last: page,
    };
  }
  const detail = details.get(page);
  if (detail)
    return {
      section: sectionCaptions[detail.section],
      parent: detail.parent,
      last: page,
    };
  return { last: page };
}

function rowOf(
  entry: Entry,
  kind: HubKind,
  shown: string,
  badges: Badges,
  role: string,
): MenuRow {
  const page = modelsLanding.get(shown) ?? details.get(shown)?.parent ?? shown;
  const kids = (entry.children ?? []).map(entryOf).filter(shownTo(kind, role));
  const row: MenuRow = {
    id: entry.id,
    label: "menu." + entry.id,
    icon: entry.icon,
  };
  if (entry.id === page) row.current = true;
  if (entry.dividedBefore) row.dividedBefore = true;
  let count = badges[entry.id] ?? 0;
  if (kids.length > 0) {
    row.expanded = entry.id === page || hasDescendant(entry, page);
    if (row.expanded)
      row.children = kids.map((kid) => rowOf(kid, kind, page, badges, role));
    else count += kids.reduce((sum, kid) => sum + (badges[kid.id] ?? 0), 0);
  }
  if (count > 0) row.badge = count;
  return row;
}

export function buildMenu(
  kind: HubKind,
  page: string,
  badges: Badges,
  role = "",
): MenuGroup[] {
  const groups: { section: Section | null; entries: Entry[] }[] = [];
  for (const entry of entries.filter(
    (e) => shownTo(kind, role)(e) && !childIds.has(e.id),
  )) {
    const last = groups[groups.length - 1];
    if (last && last.section === entry.section) last.entries.push(entry);
    else groups.push({ section: entry.section, entries: [entry] });
  }
  return groups.map((group) => ({
    caption: group.section ? sectionCaptions[group.section] : undefined,
    divided: group.section === "settings",
    rows: group.entries.map((entry) => rowOf(entry, kind, page, badges, role)),
  }));
}
