import { callTool } from "../../wakala/mcp";
import { listAllGroupOrders } from "../../market/groupOrders";
import { productName } from "../../market/productName";
import { offerWordsOf } from "../now/api";

export type Standing = "Paid" | "Cancelled" | "Delivered" | "Yes" | "Confirmed" | "Said yes" | "Said no" | "Waiting";

export type MyOrder = {
  kind: "buy" | "group";
  id: string;
  supplierId: string;
  product: string;
  quantity: number;
  unitPrice: number;
  standing: Standing;
  promisedDate: string;
  createdAt: string;
};

export type TrailLine = { id: string; actor: string; what: string; at: string };

export type MyOrdersClient = {
  listOrders: (me: string) => Promise<MyOrder[]>;
  getOrder: (orderId: string) => Promise<MyOrder>;
  getGroupLine: (groupOrderId: string, me: string) => Promise<MyOrder>;
  getTrail: (orderId: string) => Promise<TrailLine[]>;
  cancelOrder: (orderId: string) => Promise<MyOrder>;
  supplierNames: () => Promise<Record<string, string>>;
};

const text = (value: unknown) => (typeof value === "string" ? value : value == null ? "" : String(value));
const count = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : Number(value) || 0);
const itemsOf = (reply: any): any[] => (Array.isArray(reply?.items) ? reply.items : []);

export const buyStanding = (raw: any): Standing =>
  raw?.state === "cancelled"
    ? "Cancelled"
    : raw?.paid === true
      ? "Paid"
      : raw?.state === "delivered"
        ? "Delivered"
        : text(raw?.promised_date) !== ""
          ? "Yes"
          : "Waiting";

export const canCancelOrder = (order: MyOrder) => order.kind === "buy" && (order.standing === "Waiting" || order.standing === "Yes");

export const orderOf = (raw: any, words = ""): MyOrder => ({
  kind: "buy",
  id: text(raw?.id),
  supplierId: text(raw?.poster_id),
  product: words || text(raw?.product),
  quantity: count(raw?.quantity),
  unitPrice: count(raw?.unit_price),
  standing: buyStanding(raw),
  promisedDate: text(raw?.promised_date),
  createdAt: text(raw?.created_at),
});

const priceAt = (group: any, version: number): number => {
  if (version === count(group?.terms_version)) return count(group?.price);
  let history: any[] = [];
  try {
    const parsed = JSON.parse(text(group?.terms_history));
    history = Array.isArray(parsed) ? parsed : [];
  } catch {
    history = [];
  }
  const found = history.find((entry) => count(entry?.version) === version);
  return found ? count(found.price) : count(group?.price);
};

const lineStanding = (group: any, line: any): Standing =>
  group?.state === "cancelled"
    ? "Cancelled"
    : line?.paid === true
      ? "Paid"
      : line?.answer === "no"
        ? "Said no"
        : group?.state === "closed" && line?.answer !== "no"
          ? "Confirmed"
          : line?.answer === "yes"
            ? "Said yes"
            : "Waiting";

export const lineOrderOf = (group: any, line: any, words = ""): MyOrder => ({
  kind: "group",
  id: text(group?.id),
  supplierId: text(group?.poster_id),
  product: words || text(group?.product),
  quantity: count(line?.quantity),
  unitPrice: priceAt(group, count(line?.answered_version)),
  standing: lineStanding(group, line),
  promisedDate: "",
  createdAt: text(line?.created_at),
});

const mineIn = (group: any, me: string): any | undefined =>
  me === "" ? undefined : (Array.isArray(group?.lines) ? group.lines : []).find((line: any) => line?.picker === me);

const newestFirst = (a: MyOrder, b: MyOrder) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0);

const listedOffers = async (): Promise<any[]> => {
  try {
    return itemsOf(await callTool("", "market_list_offers", {}));
  } catch {
    return [];
  }
};

const offerWordsById = (offers: any[]): Record<string, string> =>
  Object.fromEntries(offers.map((o) => [text(o?.id), text(o?.product_words)]));

const groupWordsOf = (group: any, offers: any[]): string =>
  productName(
    text(group?.product),
    offers
      .filter((o) => text(o?.poster_id) === text(group?.poster_id))
      .map((o) => ({ product: text(o?.product), words: text(o?.product_words), price: text(o?.price) })),
  );

export const mcpMyOrdersClient: MyOrdersClient = {
  async listOrders(me) {
    const raws = itemsOf(await callTool("", "market_list_orders", {})).filter((raw) => me !== "" && raw?.picker === me);
    const mine = (await listAllGroupOrders({ mine: true }))
      .filter((group) => group?.direction !== "sell")
      .flatMap((group) => {
        const line = mineIn(group, me);
        return line ? [{ group, line }] : [];
      });
    const offers = raws.length > 0 || mine.length > 0 ? await listedOffers() : [];
    const words = offerWordsById(offers);
    const orders = raws.map((raw) => orderOf(raw, words[text(raw?.offer_id)]));
    const lines = mine.map(({ group, line }) => lineOrderOf(group, line, groupWordsOf(group, offers)));
    return [...orders, ...lines].sort(newestFirst);
  },
  async getOrder(orderId) {
    const raw = await callTool("", "market_get_order", { orderID: orderId });
    return orderOf(raw, await offerWordsOf(text(raw?.offer_id)));
  },
  async cancelOrder(orderId) {
    const raw = await callTool("", "market_cancel_order", { orderID: orderId });
    return orderOf(raw, await offerWordsOf(text(raw?.offer_id)));
  },
  async getGroupLine(groupOrderId, me) {
    const group = await callTool("", "market_get_group_order", { groupOrderID: groupOrderId });
    const line = mineIn(group, me);
    if (!line) throw new Error("no line of yours in this group order");
    return lineOrderOf(group, line, groupWordsOf(group, await listedOffers()));
  },
  async getTrail(orderId) {
    return itemsOf(await callTool("", "market_order_trail", { orderID: orderId }))
      .map((raw) => ({ id: text(raw?.id), actor: text(raw?.actor), what: text(raw?.what), at: text(raw?.at) }))
      .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  },
  async supplierNames() {
    return Object.fromEntries(itemsOf(await callTool("", "market_list_posters", {})).map((raw) => [text(raw?.id), text(raw?.name)]));
  },
};

export const orderTitle = (o: MyOrder) => `${o.quantity} of ${o.product}`;

export const kindWords = (o: MyOrder) => (o.kind === "group" ? "Group order" : "Buy now");

export const trailWords = (line: TrailLine, me: string): string => {
  const mine = line.actor !== "" && line.actor === me;
  if (line.what === "placed") return mine ? "You placed the order" : "The order was placed";
  if (line.what === "cancelled") return mine ? "You cancelled the order" : "The order was cancelled";
  if (line.what === "marked paid") return "The shop marked it paid";
  return line.what;
};

const shortDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const shortMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const trailDay = (line: TrailLine) => {
  const when = new Date(line.at);
  return line.at === "" || Number.isNaN(when.getTime())
    ? line.at
    : `${shortDays[when.getDay()]} ${when.getDate()} ${shortMonths[when.getMonth()]}`;
};
