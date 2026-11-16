import { hasModule, word, type AgencyView } from "../../features/agency/modules";
import { routes } from "../routes";
import type { IconName } from "../../shared/ui/Icon";
import { items as assetItems } from "./sections/assets";
import { items as councilItems } from "./sections/council";
import { items as financeItems } from "./sections/finance";
import { items as issueItems } from "./sections/issues";
import { items as propertyItems } from "./sections/properties";
import { items as residentItems } from "./sections/residents";
import { items as servicesItems } from "./sections/services";
import { items as settingsItems } from "./sections/settings";
import { items as staffItems } from "./sections/staff";

export type MenuItem = { title: string; label?: string; path?: () => string };

export type MenuSection = { id: string; title: string; icon: IconName; module?: string; items: MenuItem[] };

const notYet = (title: string): MenuItem => ({ title });

const opens = (title: string, path: () => string): MenuItem => ({ title, path });

const joined = (titles: string[], covering: MenuItem[]): MenuItem[] => titles.map((title) => covering.find((item) => item.title === title) ?? notYet(title));

export const menuSections: MenuSection[] = [
  {
    id: "residents",
    title: "People",
    icon: "users",
    module: "actor",
    items: residentItems,
  },
  {
    id: "properties",
    title: "Places & Addresses",
    icon: "pin",
    module: "digitaltwin",
    items: propertyItems,
  },
  {
    id: "issues",
    title: "Issues & Requests",
    icon: "flag",
    module: "forms",
    items: joined(["All Issues", "Assigned to Me", "Overdue", "Map View", "Service Types"], [...issueItems, opens("Overdue", routes.lateMatters.path)]),
  },
  {
    id: "services",
    title: "Services & Permits",
    icon: "document",
    module: "forms",
    items: joined(["Applications", "Permits", "Licences", "Fees & Payments", "Service Catalogue"], servicesItems),
  },
  {
    id: "assets",
    title: "Assets & Works",
    icon: "box",
    module: "assetmanager",
    items: assetItems,
  },
  {
    id: "council",
    title: "Decisions",
    icon: "landmark",
    module: "council",
    items: joined(["Meetings", "Agendas & Minutes", "Resolutions", "Rules", "Committees"], councilItems),
  },
  {
    id: "staff",
    title: "Staff & Departments",
    icon: "briefcase",
    module: "actor",
    items: staffItems,
  },
  {
    id: "finance",
    title: "Finance",
    icon: "wallet",
    module: "accounting",
    items: joined(["Budget", "Revenue & Billing", "Procurement", "Payments", "Financial Reports"], financeItems),
  },
  {
    id: "settings",
    title: "Settings",
    icon: "gear",
    items: joined(["Agency Profile", "Users & Roles", "Boundaries & Areas", "Integrations", "Audit Log"], settingsItems),
  },
];

export const sectionById = (id: string) => menuSections.find((section) => section.id === id);

const mountNameOf = (view: AgencyView | null | undefined, section: MenuSection) => {
  if (!view || view.modulesUnread || !section.module) return "";
  const position = menuSections.filter((other) => other.module === section.module).indexOf(section);
  const name = view.modules.find((module) => module.code === section.module)?.mountNames?.[position] ?? "";
  return name === section.module ? "" : name;
};

export const named = (section: MenuSection, view: AgencyView | null | undefined): MenuSection => ({
  ...section,
  title: mountNameOf(view, section) || word(view, section.title, section.module),
  items: section.items.map((item) => ({ ...item, label: word(view, item.title, section.module) })),
});

export const sectionsFor = (view: AgencyView | null | undefined): MenuSection[] => {
  if (!view || view.modulesUnread) return [];
  const held = menuSections.filter((section) => section.module && hasModule(view, section.module));
  return held.length === 0 ? [] : menuSections.filter((section) => !section.module || hasModule(view, section.module)).map((section) => named(section, view));
};
