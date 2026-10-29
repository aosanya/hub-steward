import { kes } from "../../market/money";
import { productName } from "../../market/productName";
import { callTool } from "../../wakala/mcp";

export { kes };

export type Terms = { price: number; minimum: number };

export type MyLine = { id: string; quantity: number; answer: string; joinedAt: string; answeredVersion: number };

export type OpenGroupOrder = {
  id: string;
  posterId: string;
  product: string;
  price: number;
  minimum: number;
  state: string;
  total: number;
  count: number;
  startedWith: Terms | null;
  lastSeen: Terms | null;
  date: string;
  note: string;
  mine: MyLine | null;
};

export type BoughtOrder = {
  id: string;
  posterId: string;
  product: string;
  quantity: number;
  unitPrice: number;
  state: string;
  promisedDate: string;
};

export type JoinClient = {
  getGroupOrder: (id: string, me: string) => Promise<OpenGroupOrder>;
  shopName: (posterId: string) => Promise<string>;
  productNameAt: (posterId: string, product: string) => Promise<string>;
  join: (id: string, quantity: number) => Promise<void>;
  answerRevision: (id: string, answer: "yes" | "no") => Promise<void>;
  findMyOrder: (order: OpenGroupOrder, me: string) => Promise<string>;
  getOrder: (id: string) => Promise<BoughtOrder>;
};

const text = (value: unknown) => (typeof value === "string" ? value : value == null ? "" : String(value));
const count = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : Number(value) || 0);
const itemsOf = (reply: any): any[] => (Array.isArray(reply?.items) ? reply.items : []);

const historyOf = (history: unknown): any[] => {
  try {
    const parsed = JSON.parse(text(history));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const termsOf = (entry: any): Terms | null => (entry ? { price: count(entry.price), minimum: count(entry.minimum) } : null);

export const startedWithOf = (history: unknown): Terms | null =>
  termsOf([...historyOf(history)].sort((a, b) => count(a?.version) - count(b?.version))[0]);

export const lastSeenOf = (history: unknown, answeredVersion: number, currentVersion: number): Terms | null => {
  const entries = historyOf(history);
  const answered = answeredVersion > 0 ? entries.find((entry) => count(entry?.version) === answeredVersion) : undefined;
  if (answered) return termsOf(answered);
  const before = entries
    .filter((entry) => currentVersion <= 0 || count(entry?.version) < currentVersion)
    .sort((a, b) => count(b?.version) - count(a?.version));
  return termsOf(before[0]);
};

export const myLineOf = (lines: unknown, me: string): MyLine | null => {
  if (me === "" || !Array.isArray(lines)) return null;
  const raw = lines.find((line) => text(line?.picker) === me);
  return raw ? { id: text(raw.id), quantity: count(raw.quantity), answer: text(raw.answer), joinedAt: text(raw.created_at), answeredVersion: count(raw.answered_version) } : null;
};

export const groupOrderOf = (raw: any, me: string): OpenGroupOrder => {
  const mine = myLineOf(raw?.lines, me);
  return {
    id: text(raw?.id),
    posterId: text(raw?.poster_id),
    product: text(raw?.product),
    price: count(raw?.price),
    minimum: count(raw?.minimum),
    state: text(raw?.state),
    total: count(raw?.total),
    count: count(raw?.count),
    startedWith: startedWithOf(raw?.terms_history),
    lastSeen: lastSeenOf(raw?.terms_history, mine?.answeredVersion ?? 0, count(raw?.terms_version)),
    date: text(raw?.promised_date),
    note: text(raw?.note),
    mine,
  };
};

export const orderOf = (raw: any): BoughtOrder => ({
  id: text(raw?.id),
  posterId: text(raw?.poster_id),
  product: text(raw?.product),
  quantity: count(raw?.quantity),
  unitPrice: count(raw?.unit_price),
  state: text(raw?.state),
  promisedDate: text(raw?.promised_date),
});

export const mcpJoinClient: JoinClient = {
  async getGroupOrder(id, me) {
    return groupOrderOf(await callTool("", "market_get_group_order", { groupOrderID: id }), me);
  },
  async shopName(posterId) {
    const poster = itemsOf(await callTool("", "market_list_posters", {})).find((raw) => text(raw?.id) === posterId);
    return text(poster?.name);
  },
  async productNameAt(posterId, product) {
    const offers = itemsOf(await callTool("", "market_list_offers", {}))
      .filter((raw) => text(raw?.poster_id) === posterId)
      .map((raw) => ({ product: text(raw?.product), words: text(raw?.product_words), price: text(raw?.price) }));
    return productName(product, offers);
  },
  async join(id, quantity) {
    await callTool("", "market_join_group_order", { groupOrderID: id, quantity });
  },
  async answerRevision(id, answer) {
    await callTool("", "market_answer_revision", { groupOrderID: id, answer });
  },
  async findMyOrder(order, me) {
    const mine = order.mine;
    if (order.state !== "closed" || !mine || me === "") return "";
    const joined = Date.parse(mine.joinedAt);
    if (Number.isNaN(joined)) return "";
    const product = order.product.toLowerCase();
    const found = itemsOf(await callTool("", "market_list_orders", {}))
      .map((raw) => ({ raw, at: Date.parse(text(raw?.created_at)) }))
      .filter(
        ({ raw, at }) =>
          text(raw?.picker) === me &&
          text(raw?.poster_id) === order.posterId &&
          text(raw?.state) !== "cancelled" &&
          count(raw?.quantity) === mine.quantity &&
          !Number.isNaN(at) &&
          at >= joined &&
          text(raw?.product).toLowerCase().includes(product),
      )
      .sort((a, b) => a.at - b.at);
    return text(found[0]?.raw?.id);
  },
  async getOrder(id) {
    return orderOf(await callTool("", "market_get_order", { orderID: id }));
  },
};

export const bags = (n: number) => `${n} ${n === 1 ? "bag" : "bags"}`;

export const termsWords = (terms: Terms) => `${kes(terms.price)} a bag from ${bags(terms.minimum)}`;

export const changedTermsWords = (now: Terms, started: Terms | null): string => {
  if (!started) return "";
  const changed = [now.price !== started.price ? "bulk price" : "", now.minimum !== started.minimum ? "minimum" : ""].filter(Boolean);
  return changed.join(" and ");
};

export { dayWords } from "../../ui/days";
