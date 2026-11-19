import { useLocation, useNavigate } from "react-router-dom";
import { mcpAgencyClient, type AgencyView } from "../../features/agency/modules";
import { useLoad } from "../../features/forms/useLoad";
import { useLanguage } from "../../shared/language/language";
import { homeSegment, openAgencyId } from "../../shared/wakala/openAgency";
import { headById, titleOf } from "./sectionHeads";
import { homeTab } from "../tabs";

type Origin = { path: string; title: string; sectionId?: string };

const menuPathPattern = /^(\/a\/[^/]+\/menu\/)([^/]+)\/[^/]/;

const originOf = (state: unknown): Origin | null => {
  const from = (state as { from?: Partial<Origin> } | null)?.from;
  if (typeof from?.path !== "string" || typeof from.title !== "string") return null;
  return { path: from.path, title: from.title, sectionId: typeof from.sectionId === "string" ? from.sectionId : undefined };
};

export const backOriginOf = (pathname: string): Origin | null => {
  const found = menuPathPattern.exec(pathname);
  const head = found ? headById(found[2]) : undefined;
  return found && head ? { path: `${found[1]}${head.id}`, title: head.title, sectionId: head.id } : null;
};

const homeOrigin = (base: string): Origin => ({ path: `${base}/${homeSegment}`, title: homeTab.label });

const standaloneParents: { pattern: RegExp; origin: (base: string, risksTitle: string) => Origin }[] = [
  { pattern: /^(\/a\/[^/]+)\/risks$/, origin: (base) => homeOrigin(base) },
  { pattern: /^(\/a\/[^/]+)\/backlogs$/, origin: (base) => homeOrigin(base) },
  { pattern: /^(\/a\/[^/]+)\/forms$/, origin: (base) => homeOrigin(base) },
  { pattern: /^(\/a\/[^/]+)\/council\/late-matters$/, origin: (base) => ({ path: `${base}/menu/council`, title: "", sectionId: "council" }) },
  { pattern: /^(\/a\/[^/]+)\/risk-gaps$/, origin: (base, risksTitle) => ({ path: `${base}/risks`, title: risksTitle }) },
  { pattern: /^(\/a\/[^/]+)\/council\/risks$/, origin: (base) => ({ path: `${base}/menu/council`, title: "", sectionId: "council" }) },
];

const standaloneOriginOf = (pathname: string, risksTitle: string): Origin | null => {
  const found = standaloneParents.map((parent) => ({ parent, match: parent.pattern.exec(pathname) })).find((entry) => entry.match);
  return found?.match ? found.parent.origin(found.match[1], risksTitle) : null;
};

const sectionTitleOf = (origin: Origin, view: AgencyView | null) => {
  const head = origin.sectionId ? headById(origin.sectionId) : undefined;
  return head ? titleOf(head, view) : origin.title;
};

export function useBackToSection(): { onBack?: () => void; backLabel?: string } {
  const navigate = useNavigate();
  const location = useLocation();
  const { words } = useLanguage();
  const origin = originOf(location.state) ?? backOriginOf(location.pathname) ?? standaloneOriginOf(location.pathname, words.risksTitle);
  const view = useLoad(() => (origin?.sectionId ? mcpAgencyClient.read() : Promise.resolve(null)), `back-section:${origin?.sectionId ?? ""}:${openAgencyId()}`);
  if (!origin) return {};
  return { onBack: () => navigate(origin.path), backLabel: sectionTitleOf(origin, view.state === "ready" ? view.data : null) };
}
