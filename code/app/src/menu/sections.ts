import { hasModule, type AgencyView } from "../features/agency/modules";
import { routes } from "../routes";
import type { IconName } from "../shared/ui/Icon";

export type MenuItem = { title: string; path?: () => string };

export type MenuSection = { id: string; title: string; icon: IconName; module?: string; items: MenuItem[] };

const notYet = (title: string): MenuItem => ({ title });

const opens = (title: string, path: () => string): MenuItem => ({ title, path });

export const menuSections: MenuSection[] = [
  {
    id: "residents",
    title: "Residents",
    icon: "users",
    module: "actor",
    items: ["All Residents", "Households", "Registrations", "Groups & Associations", "Communications"].map(notYet),
  },
  {
    id: "properties",
    title: "Properties & Addresses",
    icon: "pin",
    module: "digitaltwin",
    items: ["Properties", "Addresses", "Ownership & Tenure", "Land Use & Zoning"].map(notYet),
  },
  {
    id: "issues",
    title: "Issues & Requests",
    icon: "flag",
    module: "forms",
    items: [notYet("All Issues"), notYet("Assigned to Me"), opens("Overdue", routes.lateMatters.path), notYet("Map View"), notYet("Service Types")],
  },
  {
    id: "services",
    title: "Services & Permits",
    icon: "document",
    module: "forms",
    items: [opens("Applications", routes.forms.path), notYet("Permits"), notYet("Licences"), notYet("Fees & Payments"), notYet("Service Catalogue")],
  },
  {
    id: "assets",
    title: "Assets & Works",
    icon: "box",
    module: "assetmanager",
    items: ["Roads & Paths", "Street Lights", "Water Points", "Buildings", "Work Orders", "Maintenance Schedule"].map(notYet),
  },
  {
    id: "council",
    title: "Council & Decisions",
    icon: "landmark",
    module: "voting",
    items: ["Meetings", "Agendas & Minutes", "Resolutions", "Bylaws", "Committees"].map(notYet),
  },
  {
    id: "staff",
    title: "Staff & Departments",
    icon: "briefcase",
    module: "actor",
    items: ["Staff", "Departments", "Crews", "Roles & Permissions"].map(notYet),
  },
  {
    id: "finance",
    title: "Finance",
    icon: "wallet",
    module: "accounting",
    items: ["Budget", "Revenue & Billing", "Procurement", "Payments", "Financial Reports"].map(notYet),
  },
  {
    id: "settings",
    title: "Settings",
    icon: "gear",
    items: ["Municipality Profile", "Users & Roles", "Boundaries & Wards", "Integrations", "Audit Log"].map(notYet),
  },
];

export const sectionById = (id: string) => menuSections.find((section) => section.id === id);

const mountNameOf = (view: AgencyView | null | undefined, section: MenuSection) => {
  if (!view || view.modulesUnread || !section.module) return "";
  const position = menuSections.filter((other) => other.module === section.module).indexOf(section);
  const name = view.modules.find((module) => module.code === section.module)?.mountNames?.[position] ?? "";
  return name === section.module ? "" : name;
};

export const named = (section: MenuSection, view: AgencyView | null | undefined): MenuSection => {
  const title = mountNameOf(view, section);
  return title ? { ...section, title } : section;
};

export const sectionsFor = (view: AgencyView | null | undefined): MenuSection[] => {
  if (!view || view.modulesUnread) return [];
  const held = menuSections.filter((section) => section.module && hasModule(view, section.module));
  return held.length === 0 ? [] : menuSections.filter((section) => !section.module || hasModule(view, section.module)).map((section) => named(section, view));
};
