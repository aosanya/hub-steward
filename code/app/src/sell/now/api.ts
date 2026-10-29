import { callTool } from "../../wakala/mcp";
import { productsOf, type Offer, type Product } from "../../market/api";
import { askArguments, buyNowArguments, listOffersArguments } from "../../market/arguments";
import { listAllGroupOrders } from "../../market/groupOrders";
import { productName } from "../../market/productName";
import { quantityWords, priceWords } from "../../market/unitWords";
import { kes } from "../../supply/api";

export const sellNowTool = "market_ask";

export const saleTools = {
  createRequest: "market_create_wanted",
  ask: sellNowTool,
  listAsks: "market_list_asks",
  listPosters: "market_list_posters",
  listOffers: "market_list_offers",
  listYeses: "market_list_yeses",
  listOrders: "market_list_orders",
  buyNow: "market_buy_now",
} as const;

export const saleKind = "sale";

export type BuyerPrice = {
  id: string;
  buyerId: string;
  buyer: string;
  product: string;
  words: string;
  unit: string;
  price: number;
  bulkPrice: number;
  bulkFrom: number;
};

export type GroupSale = { id: string; buyerId: string; product: string; price: number; from: number };

export type Sale = {
  id: string;
  orderId: string;
  offerId: string;
  yesId: string;
  answer: string;
  buyerId: string;
  buyer: string;
  product: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  state: string;
  promisedDate: string;
};

export type SellClient = {
  listProducts: () => Promise<Product[]>;
  listPrices: (productId: string) => Promise<BuyerPrice[]>;
  listGroupSales: (productId: string) => Promise<GroupSale[]>;
  sellNow: (offerId: string, bags: number) => Promise<Sale>;
  getSale: (saleId: string) => Promise<Sale>;
  bookSale: (sale: Sale) => Promise<void>;
};

const text = (value: unknown) => (typeof value === "string" ? value : value == null ? "" : String(value));
const count = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : Number(value) || 0);
const itemsOf = (reply: any): any[] => (Array.isArray(reply?.items) ? reply.items : []);

type Names = Map<string, string>;

export const priceOf = (raw: any, names: Names): BuyerPrice => ({
  id: text(raw?.id),
  buyerId: text(raw?.poster_id),
  buyer: names.get(text(raw?.poster_id)) ?? "",
  product: text(raw?.product),
  words: text(raw?.product_words),
  unit: text(raw?.unit_words),
  price: count(raw?.price),
  bulkPrice: count(raw?.bulk_price),
  bulkFrom: count(raw?.bulk_min),
});

const marketOfferOf = (price: BuyerPrice): Offer => ({
  id: price.id,
  posterId: price.buyerId,
  product: price.product,
  shop: price.buyer,
  words: price.words,
  unit: price.unit,
  price: String(price.price),
  bulkPrice: "",
  bulkFrom: "",
});

export const nameOfProduct = (product: string, prices: BuyerPrice[]) => productName(product, prices.map(marketOfferOf));

export const groupSaleOf = (raw: any): GroupSale => ({
  id: text(raw?.id),
  buyerId: text(raw?.poster_id),
  product: text(raw?.product),
  price: count(raw?.price),
  from: count(raw?.minimum),
});

export const askedBags = (question: string) => {
  const found = question.match(/\d+/);
  return found ? Number(found[0]) : 0;
};

const unitPriceAt = (offer: any, bags: number) =>
  count(offer?.bulk_min) > 0 && count(offer?.bulk_price) > 0 && bags >= count(offer.bulk_min) ? count(offer.bulk_price) : count(offer?.price);

export const saleFrom = (ask: any, names: Names, offers: any[], yeses: any[], orders: any[]): Sale => {
  const yes = yeses.find((y) => text(y?.ask_id) === text(ask?.id));
  const order = yes ? orders.find((o) => text(o?.yes_id) === text(yes.id)) : undefined;
  const offer = offers.find((o) => text(o?.id) === text(ask?.offer_id));
  const quantity = order ? count(order.quantity) : askedBags(text(ask?.question));
  return {
    id: text(ask?.id),
    orderId: text(order?.id),
    offerId: text(ask?.offer_id),
    yesId: text(yes?.id),
    answer: text(ask?.answer),
    buyerId: text(ask?.poster_id),
    buyer: names.get(text(ask?.poster_id)) ?? "",
    product: text(ask?.product),
    unit: text(offer?.unit_words),
    quantity,
    unitPrice: order ? count(order.unit_price) : unitPriceAt(offer, quantity),
    state: order ? text(order.state) : ask?.answer === "withdrawn" ? "cancelled" : "asked",
    promisedDate: order ? text(order.promised_date) : text(yes?.date),
  };
};

export const saleQuestion = (bags: number, unit: string, product: string) => `${quantityWords(bags, unit)} of ${product}`;

const buyerNames = async (approvedOnly: boolean): Promise<Names> => {
  const posters = itemsOf(await callTool("", "market_list_posters", {}));
  return new Map(
    posters.filter((p) => !approvedOnly || p?.status === "approved").map((p) => [text(p?.id), text(p?.name)]),
  );
};

export const readSales = async (): Promise<Sale[]> => {
  const [asks, posters, offers, yeses, orders] = await Promise.all([
    callTool("", saleTools.listAsks, {}),
    callTool("", saleTools.listPosters, {}),
    callTool("", saleTools.listOffers, listOffersArguments()),
    callTool("", saleTools.listYeses, {}),
    callTool("", saleTools.listOrders, {}),
  ]);
  const names: Names = new Map(itemsOf(posters).map((p) => [text(p?.id), text(p?.name)]));
  return itemsOf(asks)
    .filter((ask) => ask?.kind === saleKind)
    .map((ask) => saleFrom(ask, names, itemsOf(offers), itemsOf(yeses), itemsOf(orders)));
};

export const readSale = async (saleId: string): Promise<Sale> => {
  const found = (await readSales()).find((sale) => sale.id === saleId);
  if (!found) throw new Error("sale not found");
  return found;
};

const approvedBuyersPrices = async (): Promise<BuyerPrice[]> => {
  const [buyers, offers] = await Promise.all([buyerNames(true), callTool("", "market_list_offers", listOffersArguments())]);
  return itemsOf(offers)
    .map((raw) => priceOf(raw, buyers))
    .filter((offer) => buyers.has(offer.buyerId));
};

export const mcpSellClient: SellClient = {
  async listProducts() {
    return productsOf((await approvedBuyersPrices()).map(marketOfferOf));
  },
  async listPrices(productId) {
    return (await approvedBuyersPrices()).filter((offer) => offer.product === productId).sort((a, b) => b.price - a.price);
  },
  async listGroupSales(productId) {
    return (await listAllGroupOrders({ state: "open" }))
      .filter((raw) => raw?.state === "open" && raw?.direction === "sell")
      .map(groupSaleOf)
      .filter((sale) => sale.product === productId);
  },
  async sellNow(offerId, bags) {
    const offer = itemsOf(await callTool("", saleTools.listOffers, listOffersArguments())).find((o) => text(o?.id) === offerId);
    if (!offer) throw new Error("offer not found");
    const product = text(offer.product);
    const question = saleQuestion(bags, text(offer.unit_words), text(offer.product_words) || product);
    const request = await callTool("", saleTools.createRequest, { wanted: question, quantity: bags });
    const ask = await callTool(
      "",
      saleTools.ask,
      askArguments({
        posterId: text(offer.poster_id),
        offerId,
        requestId: text(request?.id),
        kind: saleKind,
        product,
        question,
      }),
    );
    return readSale(text(ask?.id));
  },
  getSale: readSale,
  async bookSale(sale) {
    await callTool("", saleTools.buyNow, buyNowArguments(sale.offerId, sale.quantity, sale.yesId));
  },
};

export const groupSaleLine = (group: GroupSale) =>
  `Group sale open ${kes(group.price)} a bag from ${group.from} ${group.from === 1 ? "bag" : "bags"}`;

export const bulkWords = (offer: BuyerPrice) =>
  offer.bulkPrice > 0 && offer.bulkFrom > 0 ? `Bulk price ${priceWords(offer.bulkPrice, offer.unit)} from ${quantityWords(offer.bulkFrom, offer.unit)}` : "";

export const saleTotal = (sale: Sale) => sale.quantity * sale.unitPrice;

export type SaleStatus = "Waiting" | "Yes" | "No" | "Cancelled";

export const statusOf = (sale: Sale): SaleStatus =>
  sale.state === "cancelled" ? "Cancelled" : sale.answer === "no" ? "No" : sale.promisedDate !== "" ? "Yes" : "Waiting";
