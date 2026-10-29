import { posterOffersOf, productNameAt, type PosterOffer } from "../../market/productName";
import { mcpSupplyClient } from "../../supply/api";
import { callTool } from "../../wakala/mcp";

export type SaleLine = { picker: string; quantity: number };

export type Sale = {
  id: string;
  product: string;
  productWords: string;
  buyer: string;
  price: number;
  minimum: number;
  state: string;
  total: number;
  count: number;
  posterId?: string;
  date?: string;
  note?: string;
  lines: SaleLine[];
};

export type Collection = { date: string; note: string };

export type SaleClient = {
  getSale: (id: string) => Promise<Sale>;
  join: (id: string, quantity: number) => Promise<Sale>;
  collection?: (sale: Sale, me: string) => Promise<Collection>;
};

const text = (value: unknown) => (typeof value === "string" ? value : value == null ? "" : String(value));
const count = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : Number(value) || 0);

export const saleOf = (raw: any, buyer = "", offers: PosterOffer[] = []): Sale => ({
  id: text(raw?.id),
  product: text(raw?.product),
  productWords: productNameAt(text(raw?.product), text(raw?.poster_id), offers),
  buyer,
  price: count(raw?.price),
  minimum: count(raw?.minimum),
  state: text(raw?.state),
  total: count(raw?.total),
  count: count(raw?.count),
  posterId: text(raw?.poster_id),
  date: text(raw?.promised_date),
  note: text(raw?.note),
  lines: (Array.isArray(raw?.lines) ? raw.lines : []).map((line: any) => ({
    picker: text(line?.picker),
    quantity: count(line?.quantity),
  })),
});

const buyerName = async (posterId: string) => {
  try {
    return (await mcpSupplyClient.listSuppliers()).find((s) => s.id === posterId)?.shop ?? "";
  } catch {
    return "";
  }
};

const knownOffers = (): Promise<PosterOffer[]> => callTool("", "market_list_offers", {}).then(posterOffersOf, () => []);

const read = async (id: string) => {
  const raw = await callTool("", "market_get_group_order", { groupOrderID: id });
  return saleOf(raw, await buyerName(text(raw?.poster_id)), await knownOffers());
};

export const mcpSaleClient: SaleClient = {
  getSale: read,
  async collection(sale, me) {
    if (!ownLine(sale, me)) return { date: "", note: "" };
    return { date: sale.date ?? "", note: sale.note ?? "" };
  },
  async join(id, quantity) {
    await callTool("", "market_join_group_order", { groupOrderID: id, quantity });
    return read(id);
  },
};

export const isOpenSale = (sale: Sale) => sale.state !== "closed" && sale.state !== "cancelled";

export const ownLine = (sale: Sale, me: string): SaleLine | undefined =>
  me === "" ? undefined : sale.lines.find((line) => line.picker === me);
