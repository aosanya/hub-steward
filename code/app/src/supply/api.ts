import { callTool } from "../wakala/mcp";
import { createOfferArguments, listOffersArguments, updateOfferArguments, type OfferFields } from "../market/arguments";
import { kes } from "../market/money";
import { loadSubject, subjectNow } from "../wakala/me";

export { kes };

export type Supplier = {
  id: string;
  shop: string;
  area: string;
  sells: string;
  owner: string;
  status: string;
  approvedBy: string;
  ownerName: string;
  approvedByName: string;
};

export type SupplierApplication = { shop: string; area: string; sells: string };

export type SupplyOffer = {
  id: string;
  supplierId: string;
  product: string;
  unit: string;
  price: number;
  bulkFrom: number;
  bulkPrice: number;
  group?: string;
};

export type OfferDraft = Omit<SupplyOffer, "id" | "supplierId">;

export type SupplyClient = {
  listSuppliers: () => Promise<Supplier[]>;
  applySupplier: (application: SupplierApplication) => Promise<Supplier>;
  listOffers: (supplierId: string) => Promise<SupplyOffer[]>;
  listProducts?: () => Promise<string[]>;
  createOffer: (supplierId: string, draft: OfferDraft) => Promise<SupplyOffer>;
  updateOffer: (offer: SupplyOffer) => Promise<SupplyOffer>;
  listCoordinators?: () => Promise<string[]>;
};

const text = (value: unknown) => (typeof value === "string" ? value : value == null ? "" : String(value));
const count = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : Number(value) || 0);
const itemsOf = (reply: any): any[] => (Array.isArray(reply?.items) ? reply.items : []);

export const supplierOf = (raw: any): Supplier => ({
  id: text(raw?.id),
  shop: text(raw?.name),
  area: text(raw?.area),
  sells: text(raw?.posts),
  owner: text(raw?.owner),
  status: text(raw?.status),
  approvedBy: text(raw?.approved_by),
  ownerName: text(raw?.owner_name),
  approvedByName: text(raw?.approved_by_name),
});

export const offerOf = (raw: any): SupplyOffer => ({
  id: text(raw?.id),
  supplierId: text(raw?.poster_id),
  product: text(raw?.product_words),
  unit: text(raw?.unit_words),
  price: count(raw?.price),
  bulkFrom: count(raw?.bulk_min),
  bulkPrice: count(raw?.bulk_price),
  group: text(raw?.product) || undefined,
});

const slugOf = (words: string) =>
  words
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const productSlug = (words: string, known: string[] = []) => {
  const own = slugOf(words);
  return known.find((slug) => slug.toLowerCase() === own) ?? own;
};

export const correctedGroup = (words: string, group: string | undefined) => {
  if (!group) return group;
  const own = slugOf(words);
  return own.startsWith(`${group}-`) ? own : group;
};

const offerFieldsOf = (supplierId: string, draft: OfferDraft): OfferFields => ({
  posterId: supplierId,
  words: draft.product,
  unit: draft.unit,
  price: draft.price,
  bulkFrom: draft.bulkFrom,
  bulkPrice: draft.bulkPrice,
  group: draft.group,
});

export const mcpSupplyClient: SupplyClient = {
  async listSuppliers() {
    return itemsOf(await callTool("", "market_list_posters", {})).map(supplierOf);
  },
  async applySupplier(application) {
    return supplierOf(
      await callTool("", "market_apply_poster", { name: application.shop, area: application.area, posts: application.sells }),
    );
  },
  async listOffers(supplierId) {
    return itemsOf(await callTool("", "market_list_offers", listOffersArguments(supplierId))).map(offerOf);
  },
  async listProducts() {
    const slugs = itemsOf(await callTool("", "market_list_offers", listOffersArguments())).map((raw) => text(raw?.product));
    return [...new Set(slugs.filter((slug) => slug !== ""))];
  },
  async createOffer(supplierId, draft) {
    return offerOf(await callTool("", "market_create_offer", createOfferArguments(offerFieldsOf(supplierId, draft))));
  },
  async updateOffer(offer) {
    const { id, supplierId, ...held } = offer;
    const draft = { ...held, group: correctedGroup(held.product, held.group) };
    return offerOf(await callTool("", "market_update_offer", updateOfferArguments(id, offerFieldsOf(supplierId, draft))));
  },
  async listCoordinators() {
    const groups = itemsOf(await callTool("", "actor_list_my_groups", {})).map((g) => text(g?.id)).filter((id) => id !== "");
    const leaders = await Promise.all(
      groups.map((id) => callTool("", "actor_list_group_leaders", { group_id: id }).then(itemsOf, () => [] as any[])),
    );
    return leaderNames(leaders.flat());
  },
};

export const leaderNames = (rows: any[]): string[] => {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const row of rows) {
    const id = text(row?.actor_id);
    const name = text(row?.display_name).trim();
    if (name === "" || seen.has(id || name)) continue;
    seen.add(id || name);
    names.push(name);
  }
  return names;
};

export const waitingWords = (names: string[]) =>
  names.length === 0 ? "Waiting on the group coordinator" : `Waiting for ${names.join(", ")}`;

const storedMember = () => {
  try {
    return window.localStorage.getItem("hubsteward.member") ?? "";
  } catch {
    return "";
  }
};

export const memberId = () => subjectNow() || storedMember();

export const resolveMember = async (given?: string): Promise<string> =>
  given !== undefined && given !== "" ? given : (await loadSubject()) || storedMember();

export const mySupplier = (all: Supplier[], me: string): Supplier | undefined =>
  me === "" ? undefined : [...all].reverse().find((s) => s.owner === me);

export const isApproved = (s: Supplier | undefined) => s?.status === "approved";

export const priceWords = (o: SupplyOffer) => {
  const base = `${kes(o.price)}${o.unit ? ` a ${o.unit}` : ""}`;
  return o.bulkFrom > 0 && o.bulkPrice > 0 ? `${base} · ${o.bulkFrom} or more ${kes(o.bulkPrice)}` : base;
};

export const buyerPriceWords = (o: SupplyOffer) => {
  const base = `${kes(o.price)}${o.unit ? ` a ${o.unit}` : ""}`;
  return o.bulkFrom > 0 && o.bulkPrice > 0 ? `${base} · ${kes(o.bulkPrice)} from ${o.bulkFrom} ${o.unit ? `${o.unit}s` : "units"}` : base;
};
