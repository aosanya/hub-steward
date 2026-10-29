import { listAllGroupOrders } from "../../market/groupOrders";
import { kes } from "../../market/money";
import { posterOffersOf, productNameAt, type PosterOffer } from "../../market/productName";
import { GROUP_COORDINATOR, listPeople, namesOf, type Names } from "../../people/api";
import { callTool } from "../../wakala/mcp";

export type OrderLine = { id: string; picker: string; quantity: number; answer: string };

export type Terms = { price: number; minimum: number };

export type GroupOrder = {
  id: string;
  posterId: string;
  product: string;
  productWords: string;
  coordinator: string;
  price: number;
  minimum: number;
  termsVersion: number;
  startedWith: Terms | null;
  state: string;
  total: number;
  count: number;
  lines: OrderLine[];
};

export type GroupOrderClient = {
  listGroupOrders: () => Promise<GroupOrder[]>;
  getGroupOrder: (id: string) => Promise<GroupOrder>;
  askRevision: (id: string, terms: Terms) => Promise<void>;
};

const text = (value: unknown) => (typeof value === "string" ? value : value == null ? "" : String(value));
const count = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : Number(value) || 0);

export const lineOf = (raw: any): OrderLine => ({
  id: text(raw?.id),
  picker: text(raw?.picker_name) || text(raw?.picker),
  quantity: count(raw?.quantity),
  answer: text(raw?.answer),
});

export const startedWithOf = (history: unknown): Terms | null => {
  let entries: any[] = [];
  try {
    const parsed = JSON.parse(text(history));
    entries = Array.isArray(parsed) ? parsed : [];
  } catch {
    entries = [];
  }
  const first = [...entries].sort((a, b) => count(a?.version) - count(b?.version))[0];
  return first ? { price: count(first.price), minimum: count(first.minimum) } : null;
};

const coordinatorName = (id: string, names: Names) => (id === "" ? "" : names.get(id) || GROUP_COORDINATOR);

export const groupOrderOf = (raw: any, names: Names = new Map(), offers: PosterOffer[] = []): GroupOrder => ({
  id: text(raw?.id),
  posterId: text(raw?.poster_id),
  product: text(raw?.product),
  productWords: productNameAt(text(raw?.product), text(raw?.poster_id), offers),
  coordinator: coordinatorName(text(raw?.coordinator), names),
  price: count(raw?.price),
  minimum: count(raw?.minimum),
  termsVersion: count(raw?.terms_version),
  startedWith: startedWithOf(raw?.terms_history),
  state: text(raw?.state),
  total: count(raw?.total),
  count: count(raw?.count),
  lines: (Array.isArray(raw?.lines) ? raw.lines : []).map(lineOf),
});

const knownNames = (): Promise<Names> => listPeople().then(namesOf, () => new Map());

const knownOffers = (): Promise<PosterOffer[]> => callTool("", "market_list_offers", {}).then(posterOffersOf, () => []);

export const mcpGroupOrderClient: GroupOrderClient = {
  async listGroupOrders() {
    const [raws, names, offers] = await Promise.all([listAllGroupOrders(), knownNames(), knownOffers()]);
    return raws.map((raw) => groupOrderOf(raw, names, offers));
  },
  async getGroupOrder(id) {
    const [reply, names, offers] = await Promise.all([callTool("", "market_get_group_order", { groupOrderID: id }), knownNames(), knownOffers()]);
    return groupOrderOf(reply, names, offers);
  },
  async askRevision(id, terms) {
    await callTool("", "market_ask_revision", { groupOrderID: id, price: terms.price, minimum: terms.minimum });
  },
};

export const isLive = (order: GroupOrder) => order.state === "open" || order.state === "revising";

export const bags = (n: number) => `${n} ${n === 1 ? "bag" : "bags"}`;

export const farmersWords = (n: number) => `${n} ${n === 1 ? "farmer" : "farmers"}`;

export const termsWords = (terms: Terms) => `${kes(terms.price)} a bag from ${bags(terms.minimum)}`;

export const tally = (lines: OrderLine[]) => ({
  yes: lines.filter((l) => l.answer === "yes").length,
  no: lines.filter((l) => l.answer === "no").length,
  waiting: lines.filter((l) => l.answer === "waiting").length,
});
