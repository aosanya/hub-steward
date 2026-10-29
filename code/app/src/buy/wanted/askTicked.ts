import type { Offer, Shop, Wanted, WantedClient } from "./api";
import { bestOffer } from "./matchOffer";

const offerFor = async (client: Pick<WantedClient, "listOffers">, shopId: string, wanted: Wanted) => {
  const offers: Offer[] = await client.listOffers(shopId).catch(() => []);
  return bestOffer(wanted.what, offers)?.id;
};

const askOne = async (client: Pick<WantedClient, "ask" | "listOffers">, requestId: string, shop: Shop, wanted: Wanted) => {
  const offerId = await offerFor(client, shop.id, wanted);
  return offerId ? client.ask(requestId, shop.id, wanted, offerId) : client.ask(requestId, shop.id, wanted);
};

export const askTicked = async (
  client: Pick<WantedClient, "ask" | "listOffers">,
  requestId: string,
  wanted: Wanted,
  shops: Shop[],
  ticked: Set<string>,
) => {
  const chosen = [...new Map(shops.filter((shop) => ticked.has(shop.id)).map((shop) => [shop.id, shop])).values()];
  const results = await Promise.allSettled(chosen.map((shop) => askOne(client, requestId, shop, wanted)));
  return { asked: chosen.length, failed: results.filter((result) => result.status === "rejected").length };
};
