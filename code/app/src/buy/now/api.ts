import { callTool } from "../../wakala/mcp";
import { buyNowArguments, listOffersArguments } from "../../market/arguments";

export type BuyOffer = {
  id: string;
  posterId: string;
  shop: string;
  words: string;
  product: string;
  unit: string;
  unitPrice: number;
};

export type BuyOrder = {
  id: string;
  posterId: string;
  shop: string;
  product: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  state: string;
  promisedDate: string;
  paid: boolean;
};

export type OrderStatus = "Waiting" | "Yes" | "Cancelled" | "Delivered" | "Paid";

export type BuyNowClient = {
  getOffer: (offerId: string) => Promise<BuyOffer>;
  buyNow: (offerId: string, quantity: number, yesId?: string) => Promise<BuyOrder>;
  getOrder: (orderId: string) => Promise<BuyOrder>;
  cancelOrder: (orderId: string) => Promise<BuyOrder>;
};

const text = (value: unknown) => (typeof value === "string" ? value : value == null ? "" : String(value));
const count = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : Number(value) || 0);
const itemsOf = (reply: any): any[] => (Array.isArray(reply?.items) ? reply.items : []);

export const buyOrderOf = (raw: any, shop = "", words = "", unit = ""): BuyOrder => ({
  id: text(raw?.id),
  posterId: text(raw?.poster_id),
  shop,
  product: words || text(raw?.product),
  unit,
  quantity: count(raw?.quantity),
  unitPrice: count(raw?.unit_price),
  state: text(raw?.state),
  promisedDate: text(raw?.promised_date),
  paid: raw?.paid === true,
});

export const buyOfferOf = (raw: any, shop = ""): BuyOffer => ({
  id: text(raw?.id),
  posterId: text(raw?.poster_id),
  shop,
  words: text(raw?.product_words),
  product: text(raw?.product),
  unit: text(raw?.unit_words),
  unitPrice: count(raw?.price),
});

const shopNameOf = async (posterId: string) => {
  if (posterId === "") return "";
  const posters = itemsOf(await callTool("", "market_list_posters", {}));
  return text(posters.find((p) => text(p?.id) === posterId)?.name);
};

type OfferRead = { words: string; unit: string };

const offerReadOf = async (offerId: string): Promise<OfferRead> => {
  if (offerId === "") return { words: "", unit: "" };
  try {
    const offers = itemsOf(await callTool("", "market_list_offers", listOffersArguments()));
    const found = offers.find((o) => text(o?.id) === offerId);
    return { words: text(found?.product_words), unit: text(found?.unit_words) };
  } catch {
    return { words: "", unit: "" };
  }
};

export const offerWordsOf = async (offerId: string): Promise<string> => (await offerReadOf(offerId)).words;

const orderWithShop = async (raw: any) => {
  const [shop, offer] = await Promise.all([shopNameOf(text(raw?.poster_id)), offerReadOf(text(raw?.offer_id))]);
  return buyOrderOf(raw, shop, offer.words, offer.unit);
};

export const mcpBuyNowClient: BuyNowClient = {
  async getOffer(offerId) {
    const offer = itemsOf(await callTool("", "market_list_offers", listOffersArguments())).find((o) => text(o?.id) === offerId);
    if (!offer) throw new Error("offer not found");
    return buyOfferOf(offer, await shopNameOf(text(offer.poster_id)));
  },
  async buyNow(offerId, quantity, yesId) {
    return orderWithShop(await callTool("", "market_buy_now", buyNowArguments(offerId, quantity, yesId)));
  },
  async getOrder(orderId) {
    return orderWithShop(await callTool("", "market_get_order", { orderID: orderId }));
  },
  async cancelOrder(orderId) {
    return orderWithShop(await callTool("", "market_cancel_order", { orderID: orderId }));
  },
};

export const orderTotal = (order: BuyOrder) => order.quantity * order.unitPrice;
