import { routes } from "../../routes";
import { kes } from "../../supply/api";
import type { Asked, Found, Offer, Shop, Wanted } from "./api";
import { dayName } from "./dates";

export type FoundRow = { id: string; name: string; meta: string; buyPath: string };

export const shopNameOf = (shops: Shop[], id: string) => shops.find((shop) => shop.id === id)?.name || "Shop";

const priceOf = (offer: Offer | undefined) =>
  offer && offer.price > 0 ? `${kes(offer.price)}${offer.unit ? ` a ${offer.unit}` : ""}` : "";

export const foundRows = (found: Found[], asked: Asked[], shops: Shop[], offers: Offer[]): FoundRow[] => {
  const askIds = new Set(asked.map((ask) => ask.id));
  return found
    .filter((yes) => askIds.has(yes.askId))
    .map((yes) => {
      const offerId = yes.offerId || asked.find((ask) => ask.id === yes.askId)?.offerId || "";
      const offer = offers.find((candidate) => candidate.id === offerId);
      return {
        id: yes.id,
        name: shopNameOf(shops, yes.shopId),
        meta: [priceOf(offer), yes.what, yes.quantity, yes.date && `by ${dayName(yes.date)}`, yes.note].filter(Boolean).join(" · "),
        buyPath: offerId ? routes.buyNow.path({ productId: offer?.product || offerId, offerId }, yes.id ? { yes: yes.id } : undefined) : "",
      };
    });
};

export const wantedFromAsks = (asked: Asked[]): Wanted => {
  const ask = asked.find((candidate) => candidate.question !== "");
  const parts = /^(.*?)\s*(?:by (\d{4}-\d{2}-\d{2}))?$/.exec(ask?.detail.trim() ?? "");
  return { what: ask?.question ?? "", quantity: parts?.[1] ?? "", neededBy: parts?.[2] ?? "" };
};
