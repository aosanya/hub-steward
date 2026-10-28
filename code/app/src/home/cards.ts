import type { AgencyView } from "../agency/modules";
import { routes } from "../routes";

export type AgencyKind = "farmers" | "supplier";

export type HomeCard = { title: string; path: string };

const forms = (): HomeCard => ({ title: "Forms", path: routes.forms.path() });
const yourPrices: HomeCard = { title: "Your prices", path: "/prices" };

export const marketCards: HomeCard[] = [
  { title: "Offers", path: "/offers" },
  { title: "Asks", path: "/asks" },
  { title: "Group order", path: "/group-orders" },
  { title: "Orders", path: "/orders" },
];

export const agencyCards: Record<AgencyKind, HomeCard[]> = {
  get farmers() {
    return [forms()];
  },
  get supplier() {
    return [...marketCards, yourPrices, forms()];
  },
};

const moduleOfMarketPath: Record<string, string> = {
  "/prices": "market",
  "/offers": "market",
  "/asks": "market",
  "/group-orders": "market",
  "/orders": "market",
};

const moduleOfPath = (path: string) => (path === routes.forms.path() ? "forms" : moduleOfMarketPath[path]);

export const homeCardsFor = (kind: AgencyKind, view?: AgencyView | null): HomeCard[] => {
  const cards = agencyCards[kind];
  if (!view || view.modulesUnread) return cards;
  const on = new Set(view.modules.map((module) => module.code));
  return cards
    .filter((card) => !moduleOfPath(card.path) || on.has(moduleOfPath(card.path)))
    .map((card) => {
      const named = moduleOfPath(card.path) === "forms" ? view.modules.find((module) => module.code === "forms")?.name : "";
      return named ? { ...card, title: named } : card;
    });
};
