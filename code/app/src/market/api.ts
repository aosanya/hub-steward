import { callTool } from "../wakala/mcp";
import { listAllGroupOrders } from "./groupOrders";
import { kes } from "./money";
import { productName } from "./productName";

export type Product = { id: string; name: string; shops: number; fromPrice: string };

export type Offer = {
  id: string;
  posterId: string;
  product: string;
  shop: string;
  words: string;
  unit: string;
  price: string;
  bulkPrice: string;
  bulkFrom: string;
};

export type GroupOrder = { id: string; posterId: string; product: string; price: string; from: string };

export type MarketClient = {
  listProducts: () => Promise<Product[]>;
  listOffers: (productId: string) => Promise<Offer[]>;
  listGroupOrders: (productId: string) => Promise<GroupOrder[]>;
};

const text = (value: unknown) => (typeof value === "string" ? value : value == null ? "" : String(value));

const itemsOf = (reply: any): any[] => (Array.isArray(reply?.items) ? reply.items : []);

const offerOf = (raw: any): Offer => ({
  id: text(raw?.id),
  posterId: text(raw?.poster_id),
  product: text(raw?.product),
  shop: "",
  words: text(raw?.product_words),
  unit: text(raw?.unit_words),
  price: text(raw?.price),
  bulkPrice: raw?.bulk_price ? text(raw.bulk_price) : "",
  bulkFrom: raw?.bulk_min ? text(raw.bulk_min) : "",
});

const groupOrderOf = (raw: any): GroupOrder => ({
  id: text(raw?.id),
  posterId: text(raw?.poster_id),
  product: text(raw?.product),
  price: text(raw?.price),
  from: text(raw?.minimum),
});

const priceOf = (offer: Offer) => Number(offer.price) || Infinity;

const lowestPrice = (group: Offer[]) => {
  const lowest = Math.min(...group.map(priceOf));
  return Number.isFinite(lowest) ? kes(lowest) : "";
};

export const productsOf = (offers: Offer[]): Product[] => {
  const byProduct = new Map<string, Offer[]>();
  offers.forEach((offer) => byProduct.set(offer.product, [...(byProduct.get(offer.product) ?? []), offer]));
  return [...byProduct.entries()]
    .filter(([id]) => id !== "")
    .map(([id, group]) => ({
      id,
      name: productName(id, group),
      shops: new Set(group.map((offer) => offer.posterId)).size,
      fromPrice: lowestPrice(group),
    }));
};

const allOffers = async () => itemsOf(await callTool("", "market_list_offers", {})).map(offerOf);

const shopNames = async () =>
  new Map(itemsOf(await callTool("", "market_list_posters", {})).map((raw) => [text(raw?.id), text(raw?.name)]));

export const mcpMarketClient: MarketClient = {
  async listProducts() {
    return productsOf(await allOffers());
  },
  async listOffers(productId) {
    const [offers, names] = await Promise.all([allOffers(), shopNames()]);
    return offers
      .filter((offer) => offer.product === productId)
      .map((offer) => ({ ...offer, shop: names.get(offer.posterId) ?? "" }))
      .sort((a, b) => priceOf(a) - priceOf(b));
  },
  async listGroupOrders(productId) {
    return (await listAllGroupOrders({ state: "open" }))
      .filter((raw) => raw?.state === "open" && raw?.direction !== "sell")
      .map(groupOrderOf)
      .filter((order) => order.product === productId);
  },
};
