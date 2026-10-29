import { callTool } from "../../wakala/mcp";
import { askArguments, listOffersArguments } from "../../market/arguments";

export type Wanted = { what: string; quantity: string; neededBy: string };

export type Shop = { id: string; name: string };

export type Asked = {
  id: string;
  shopId: string;
  answer: "waiting" | "yes" | "no";
  offerId: string;
  question: string;
  detail: string;
};

export type Found = {
  id: string;
  askId: string;
  shopId: string;
  offerId: string;
  what: string;
  quantity: string;
  date: string;
  note: string;
};

export type Offer = { id: string; product: string; words: string; price: number; unit: string };

export type Notice = { id: string; what: string; quantity: string; neededBy: string; open: boolean };

export type WantedClient = {
  createWanted: (wanted: Wanted) => Promise<string>;
  listShops: () => Promise<Shop[]>;
  ask: (requestId: string, shopId: string, wanted: Wanted, offerId?: string) => Promise<void>;
  listAsked: (requestId: string) => Promise<Asked[]>;
  listFound: () => Promise<Found[]>;
  listOffers: (shopId?: string) => Promise<Offer[]>;
  createNotice: (wanted: Wanted) => Promise<string>;
  listNotices: () => Promise<Notice[]>;
  withdrawNotice: (noticeId: string) => Promise<void>;
};

const text = (value: unknown) => (typeof value === "string" ? value : value == null ? "" : String(value));

const itemsOf = (reply: any): any[] => (Array.isArray(reply?.items) ? reply.items : []);

const amountOf = (typed: string) => {
  const amount = Number(typed.trim());
  return Number.isFinite(amount) && amount > 0 ? amount : undefined;
};

export const wantedBody = (wanted: Wanted) => ({
  wanted: wanted.what.trim(),
  ...(amountOf(wanted.quantity) ? { quantity: amountOf(wanted.quantity) } : {}),
  ...(wanted.neededBy ? { needed_by: wanted.neededBy } : {}),
});

const detailOf = (wanted: Wanted) =>
  [wanted.quantity.trim(), wanted.neededBy && `by ${wanted.neededBy}`].filter(Boolean).join(" ");

const shopOf = (raw: any): Shop => ({ id: text(raw?.id), name: text(raw?.name) });

const askedOf = (raw: any): Asked => ({
  id: text(raw?.id),
  shopId: text(raw?.poster_id),
  answer: raw?.answer === "yes" || raw?.answer === "no" ? raw.answer : "waiting",
  offerId: text(raw?.offer_id),
  question: text(raw?.question),
  detail: text(raw?.detail),
});

const foundOf = (raw: any): Found => ({
  id: text(raw?.id),
  askId: text(raw?.ask_id),
  shopId: text(raw?.poster_id),
  offerId: text(raw?.offer_id),
  what: text(raw?.what),
  quantity: raw?.quantity ? text(raw.quantity) : "",
  date: text(raw?.date),
  note: text(raw?.note),
});

const offerOf = (raw: any): Offer => ({
  id: text(raw?.id),
  product: text(raw?.product),
  words: text(raw?.product_words),
  price: Number(raw?.price) || 0,
  unit: text(raw?.unit_words),
});

const noticeOf = (raw: any): Notice => ({
  id: text(raw?.id),
  what: text(raw?.wanted),
  quantity: raw?.quantity ? text(raw.quantity) : "",
  neededBy: text(raw?.needed_by),
  open: raw?.state === "open",
});

export const isTakingAsks = (raw: any) => raw?.status === "approved" && raw?.availability !== "away";

export const mcpWantedClient: WantedClient = {
  async createWanted(wanted) {
    return text((await callTool("", "market_create_wanted", wantedBody(wanted)))?.id);
  },
  async listShops() {
    return itemsOf(await callTool("", "market_list_posters", {})).filter(isTakingAsks).map(shopOf);
  },
  async ask(requestId, shopId, wanted, offerId) {
    await callTool(
      "",
      "market_ask",
      askArguments({ posterId: shopId, requestId, question: wanted.what.trim(), offerId, detail: detailOf(wanted) }),
    );
  },
  async listAsked(requestId) {
    return itemsOf(await callTool("", "market_list_asks", {}))
      .filter((raw) => raw?.request_id === requestId)
      .map(askedOf);
  },
  async listFound() {
    return itemsOf(await callTool("", "market_list_yeses", {})).map(foundOf);
  },
  async listOffers(shopId) {
    return itemsOf(await callTool("", "market_list_offers", listOffersArguments(shopId))).map(offerOf);
  },
  async createNotice(wanted) {
    return text((await callTool("", "market_create_notice", wantedBody(wanted)))?.id);
  },
  async listNotices() {
    return itemsOf(await callTool("", "market_list_notices", {})).map(noticeOf);
  },
  async withdrawNotice(noticeId) {
    await callTool("", "market_withdraw_notice", { noticeID: noticeId });
  },
};
