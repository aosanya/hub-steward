import { isWaiting, mcpChatClient, type Ask, type AskAnswer } from "../../chat/api";
import { kes } from "../../market/money";
import { mcpSupplyClient, resolveMember, type SupplyOffer } from "../../supply/api";
import { callTool } from "../../wakala/mcp";

export type BuyerAsk = Ask & { posterId: string; offerId?: string };

export type BuyerAskClient = {
  list: (me?: string) => Promise<BuyerAsk[]>;
  offers?: (me?: string) => Promise<SupplyOffer[]>;
  answer: (askId: string, reply: AskAnswer) => Promise<void>;
};

const text = (value: unknown) => (typeof value === "string" ? value : value == null ? "" : String(value));

export const buyerAskOf = (raw: any): BuyerAsk => ({
  id: text(raw?.id),
  posterId: text(raw?.poster_id),
  offerId: text(raw?.offer_id),
  asker: text(raw?.picker_name) || text(raw?.picker),
  question: text(raw?.question),
  answer: text(raw?.answer),
  detail: text(raw?.detail),
});

const myPosterIds = async (me?: string) => {
  const member = await resolveMember(me);
  return (await mcpSupplyClient.listSuppliers()).filter((s) => member !== "" && s.owner === member).map((s) => s.id);
};

export const mcpBuyerAskClient: BuyerAskClient = {
  async offers(me) {
    const lists = await Promise.all((await myPosterIds(me)).map((id) => mcpSupplyClient.listOffers(id)));
    return lists.flat();
  },
  async list(me) {
    const mine = new Set(await myPosterIds(me));
    const reply = await callTool("", "market_list_asks", {});
    return (Array.isArray(reply?.items) ? reply.items : []).map(buyerAskOf).filter((ask: BuyerAsk) => mine.has(ask.posterId));
  },
  answer: (askId, reply) => mcpChatClient.answerAsk(askId, reply),
};


export const waitingAsks = (asks: BuyerAsk[]) => asks.filter(isWaiting);

export const answeredAsks = (asks: BuyerAsk[]) => asks.filter((ask) => !isWaiting(ask));

const wordsOf = (words: string) => words.toLowerCase().match(/[a-z]{3,}/g) ?? [];

const quantityIn = (question: string) => {
  const found = question.match(/\d+(?:\.\d+)?/);
  return found ? Number(found[0]) : 0;
};

const unitPriceAt = (offer: SupplyOffer, quantity: number) =>
  offer.bulkFrom > 0 && offer.bulkPrice > 0 && quantity >= offer.bulkFrom ? offer.bulkPrice : offer.price;

const matchOffer = (ask: BuyerAsk, offers: SupplyOffer[]) => {
  const named = offers.find((offer) => ask.offerId && offer.id === ask.offerId);
  if (named) return named;
  const asked = new Set(wordsOf(ask.question));
  const scored = offers
    .filter((offer) => offer.supplierId === ask.posterId)
    .map((offer) => ({ offer, score: wordsOf(offer.product).filter((word) => asked.has(word)).length }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored[0]?.offer;
};

export type AskPrice = { quantity: number; unitWords: string; totalWords: string };

export const askPrice = (ask: BuyerAsk, offers: SupplyOffer[]): AskPrice | null => {
  const offer = matchOffer(ask, offers);
  const quantity = quantityIn(ask.question);
  if (!offer || quantity <= 0) return null;
  const price = unitPriceAt(offer, quantity);
  return {
    quantity,
    unitWords: `${kes(price)}${offer.unit ? ` a ${offer.unit}` : ""}`,
    totalWords: `${kes(price * quantity)} in all`,
  };
};
