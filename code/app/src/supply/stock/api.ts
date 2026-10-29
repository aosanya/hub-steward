import { callTool } from "../../wakala/mcp";
import { getStockArguments, setStockArguments } from "../../market/arguments";
import { isApproved, mcpSupplyClient, mySupplier, resolveMember, type SupplyClient } from "../api";
import type { AskText, StockReader } from "../asks/stock";
import { mcpOrdersClient, type SupplyYes } from "../orders/api";

export type StockEntry = { product: string; count: number };

export type StockClient = {
  getStock: (supplierId: string) => Promise<StockEntry[]>;
  setStock: (supplierId: string, entry: StockEntry) => Promise<void>;
};

const entryOf = (raw: any): StockEntry => ({
  product: typeof raw?.product === "string" ? raw.product : "",
  count: typeof raw?.count === "number" && Number.isFinite(raw.count) ? raw.count : Number(raw?.count) || 0,
});

export const mcpStockClient: StockClient = {
  async getStock(supplierId) {
    const reply: any = await callTool("", "market_get_stock", getStockArguments(supplierId));
    const items = Array.isArray(reply?.items) ? reply.items : Array.isArray(reply) ? reply : [];
    return items.map(entryOf);
  },
  async setStock(supplierId, entry) {
    await callTool("", "market_set_stock", setStockArguments(supplierId, entry.product, entry.count));
  },
};

const lower = (value: string) => value.trim().toLowerCase();

export const sameProduct = (a: string, b: string) => {
  const x = lower(a);
  const y = lower(b);
  return x !== "" && y !== "" && (x.includes(y) || y.includes(x));
};

const escaped = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const mentions = (text: string, product: string) => {
  const name = lower(product);
  if (name === "") return false;
  const phrase = name.split(/\s+/).map(escaped).join("\\s+");
  return new RegExp(`(^|[^a-z0-9])${phrase}s?($|[^a-z0-9])`).test(lower(text));
};

export type AskRecord = { id: string; offerId: string; product: string; question: string; detail: string };

const textOf = (value: unknown) => (typeof value === "string" ? value : "");

export const listAskRecords = async (): Promise<AskRecord[]> => {
  const reply: any = await callTool("", "market_list_asks", {});
  const items = Array.isArray(reply?.items) ? reply.items : Array.isArray(reply) ? reply : [];
  return items.map((raw: any) => ({
    id: textOf(raw?.id),
    offerId: textOf(raw?.offer_id),
    product: textOf(raw?.product),
    question: textOf(raw?.question),
    detail: textOf(raw?.detail),
  }));
};

export type PromiseLookup = { asks: AskRecord[]; offerProducts: Record<string, string> };

const noLookup: PromiseLookup = { asks: [], offerProducts: {} };

const yesIsForProduct = (yes: SupplyYes, product: string, lookup: PromiseLookup) => {
  if (yes.what !== "") return sameProduct(yes.what, product);
  const ask = lookup.asks.find((a) => a.id === yes.askId);
  if (!ask) return false;
  const offerProduct = lookup.offerProducts[ask.offerId] ?? "";
  return (
    mentions(`${ask.question} ${ask.detail} ${ask.product}`, product) ||
    (offerProduct !== "" && sameProduct(offerProduct, product))
  );
};

export const promisedBags = (yeses: SupplyYes[], product?: string, lookup: PromiseLookup = noLookup) =>
  yeses
    .filter((y) => y.state === "open" && (product === undefined || yesIsForProduct(y, product, lookup)))
    .reduce((sum, y) => sum + y.quantity, 0);

export const askedEntry = (entries: StockEntry[], ask?: AskText): StockEntry | null => {
  const words = `${ask?.question ?? ""} ${ask?.detail ?? ""}`;
  const named = entries.filter((e) => mentions(words, e.product)).sort((a, b) => b.product.length - a.product.length);
  if (named.length > 0) return named[0];
  return entries.length === 1 ? entries[0] : null;
};

export const mcpStockReader =
  (
    stock: StockClient = mcpStockClient,
    supply: SupplyClient = mcpSupplyClient,
    me?: string,
    yeses: () => Promise<SupplyYes[]> = mcpOrdersClient.listYeses,
    asks: () => Promise<AskRecord[]> = listAskRecords,
  ): StockReader =>
  async (ask) => {
    const mine = mySupplier(await supply.listSuppliers(), await resolveMember(me));
    if (!isApproved(mine)) return null;
    const entry = askedEntry(await stock.getStock(mine!.id), ask);
    if (!entry) return null;
    const open = (await yeses()).filter((y) => y.state === "open");
    const needsLookup = open.some((y) => y.what === "");
    const lookup: PromiseLookup = needsLookup ? await promiseLookup(supply, mine!.id, asks) : noLookup;
    return { listed: entry.count, promised: promisedBags(open, entry.product, lookup), unit: "bags" };
  };

const promiseLookup = async (supply: SupplyClient, supplierId: string, asks: () => Promise<AskRecord[]>): Promise<PromiseLookup> => {
  const [records, offers] = await Promise.all([asks(), supply.listOffers(supplierId)]);
  const offerProducts: Record<string, string> = {};
  for (const o of offers) offerProducts[o.id] = o.product;
  return { asks: records, offerProducts };
};
