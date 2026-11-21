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

export type MenuItem = { title: string; label?: string; wordIn?: string; needs?: string; module?: string; path?: () => string };

export type MenuSection = SectionHead & { items: MenuItem[] };

const notYet = (title: string): MenuItem => ({ title });

const opens = (title: string, path: () => string): MenuItem => ({ title, path });

const joined = (titles: string[], covering: MenuItem[]): MenuItem[] => titles.map((title) => covering.find((item) => item.title === title) ?? notYet(title));

const itemsOf: Record<string, MenuItem[]> = {
  residents: residentItems,
  properties: propertyItems,
  issues: joined(["All Issues", "Assigned to Me", "Overdue", "Map View", "Service Types", "Wishes", "Send a Wish", "Question", "Rounds by Neighbourhood"], [...issueItems, opens("Overdue", routes.lateMatters.path)]),
  services: joined(["Applications", "Permits", "Licences", "Fees & Payments", "Service Catalogue"], servicesItems),
  assets: assetItems,
  council: joined(["Meetings", "Agendas & Minutes", "Resolutions", "Rules", "Committees"], councilItems),
  staff: staffItems,
  finance: joined(["Budget", "Spending by Neighbourhood", "Revenue & Billing", "Procurement", "Payments", "Financial Reports", "National Report"], financeItems),
  settings: settingsItems,
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

export type MenuItemHeld = { holds: (permission: string) => boolean; view: AgencyView | null | undefined; sectionModule?: string };

export const menuItemShown = (item: MenuItem, held: MenuItemHeld) => {
  const module = item.module ?? held.sectionModule;
  return (item.needs === undefined || held.holds(item.needs)) && (module === undefined || hasModule(held.view, module));
};

export const menuItemOf = (reference: string): { section: MenuSection; item: MenuItem } | undefined => {
  const at = reference.indexOf("/");
  const section = sectionById(reference.slice(0, at));
  const item = section?.items.find((one) => one.title === reference.slice(at + 1));
  return section && item ? { section, item } : undefined;
};

export const sectionsFor = (view: AgencyView | null | undefined): MenuSection[] => {
  if (!view || view.modulesUnread) return [];
  const held = menuSections.filter((section) => section.module && hasModule(view, section.module));
  return held.length === 0 ? [] : menuSections.filter((section) => !section.module || hasModule(view, section.module)).map((section) => named(section, view));
};
