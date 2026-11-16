import { hasModule, word, type AgencyView } from "../../features/agency/modules";
import { sectionHeads, titleOf, type SectionHead } from "./sectionHeads";
import { routes } from "../routes";
import { items as assetItems } from "./sections/assets";
import { items as councilItems } from "./sections/council";
import { items as financeItems } from "./sections/finance";
import { items as issueItems } from "./sections/issues";
import { items as propertyItems } from "./sections/properties";
import { items as residentItems } from "./sections/residents";
import { items as servicesItems } from "./sections/services";
import { items as settingsItems } from "./sections/settings";
import { items as staffItems } from "./sections/staff";

export type MenuItem = { title: string; label?: string; wordIn?: string; path?: () => string };

export type MenuSection = SectionHead & { items: MenuItem[] };

const notYet = (title: string): MenuItem => ({ title });

const opens = (title: string, path: () => string): MenuItem => ({ title, path });

const joined = (titles: string[], covering: MenuItem[]): MenuItem[] => titles.map((title) => covering.find((item) => item.title === title) ?? notYet(title));

const itemsOf: Record<string, MenuItem[]> = {
  residents: residentItems,
  properties: propertyItems,
  issues: joined(["All Issues", "Assigned to Me", "Overdue", "Map View", "Service Types"], [...issueItems, opens("Overdue", routes.lateMatters.path)]),
  services: joined(["Applications", "Permits", "Licences", "Fees & Payments", "Service Catalogue"], servicesItems),
  assets: assetItems,
  council: joined(["Meetings", "Agendas & Minutes", "Resolutions", "Rules", "Committees"], councilItems),
  staff: staffItems,
  finance: joined(["Budget", "Revenue & Billing", "Procurement", "Payments", "Financial Reports"], financeItems),
  settings: joined(["Agency Profile", "Users & Roles", "Boundaries & Areas", "Integrations", "Audit Log"], settingsItems),
};

export const menuSections: MenuSection[] = sectionHeads.map((head) => ({ ...head, items: itemsOf[head.id] }));

export const sectionById = (id: string) => menuSections.find((section) => section.id === id);

const labelOf = (item: MenuItem, section: MenuSection, view: AgencyView | null | undefined) =>
  item.wordIn ? item.title.replace(item.wordIn, word(view, item.wordIn, section.module)) : word(view, item.title, section.module);

export const named = (section: MenuSection, view: AgencyView | null | undefined): MenuSection => ({
  ...section,
  title: titleOf(section, view),
  items: section.items.map((item) => ({ ...item, label: labelOf(item, section, view) })),
});

export const sectionsFor = (view: AgencyView | null | undefined): MenuSection[] => {
  if (!view || view.modulesUnread) return [];
  const held = menuSections.filter((section) => section.module && hasModule(view, section.module));
  return held.length === 0 ? [] : menuSections.filter((section) => !section.module || hasModule(view, section.module)).map((section) => named(section, view));
};
