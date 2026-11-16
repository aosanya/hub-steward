import { word, type AgencyView } from "../../features/agency/modules";
import type { IconName } from "../../shared/ui/Icon";

export type SectionHead = { id: string; title: string; icon: IconName; module?: string };

export const sectionHeads: SectionHead[] = [
  { id: "residents", title: "People", icon: "users", module: "actor" },
  { id: "properties", title: "Places & Addresses", icon: "pin", module: "digitaltwin" },
  { id: "issues", title: "Issues & Requests", icon: "flag", module: "forms" },
  { id: "services", title: "Services & Permits", icon: "document", module: "forms" },
  { id: "assets", title: "Assets & Works", icon: "box", module: "assetmanager" },
  { id: "council", title: "Decisions", icon: "landmark", module: "council" },
  { id: "staff", title: "Staff & Departments", icon: "briefcase", module: "actor" },
  { id: "finance", title: "Finance", icon: "wallet", module: "accounting" },
  { id: "settings", title: "Settings", icon: "gear" },
];

export const headById = (id: string) => sectionHeads.find((head) => head.id === id);

const mountNameOf = (view: AgencyView | null | undefined, head: SectionHead) => {
  if (!view || view.modulesUnread || !head.module) return "";
  const position = sectionHeads.filter((other) => other.module === head.module).findIndex((other) => other.id === head.id);
  const name = view.modules.find((module) => module.code === head.module)?.mountNames?.[position] ?? "";
  return name === head.module ? "" : name;
};

export const titleOf = (head: SectionHead, view: AgencyView | null | undefined) => mountNameOf(view, head) || word(view, head.title, head.module);
