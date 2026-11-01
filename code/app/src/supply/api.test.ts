import { afterEach, describe, expect, it, vi } from "vitest";
import * as mcp from "../wakala/mcp";
import {
  buyerPriceWords,
  isApproved,
  leaderNames,
  mcpSupplyClient,
  mySupplier,
  offerOf,
  priceWords,
  productSlug,
  supplierOf,
  waitingWords,
  type Supplier,
  type SupplyOffer,
} from "./api";

afterEach(() => vi.restoreAllMocks());

const supplier = (over: Partial<Supplier>): Supplier => ({
  id: "p",
  shop: "",
  area: "",
  sells: "",
  owner: "",
  status: "",
  approvedBy: "",
  ownerName: "",
  approvedByName: "",
  ...over,
});

const priced = (over: Partial<SupplyOffer>): SupplyOffer => ({ id: "o", supplierId: "p", product: "Maize", unit: "bag", price: 3000, bulkFrom: 0, bulkPrice: 0, ...over });

describe("a supplier or offer with fields missing", () => {
  it("turns null, undefined and numbers into text", () => {
    expect(supplierOf({ name: null, area: 7 })).toMatchObject({ shop: "", area: "7", id: "", owner: "" });
    expect(supplierOf(null)).toMatchObject({ id: "", shop: "", status: "" });
  });

  it("reads numbers from strings and zeroes the rest", () => {
    expect(offerOf({ price: "12.5", bulk_min: "x", bulk_price: null })).toMatchObject({ price: 12.5, bulkFrom: 0, bulkPrice: 0 });
    expect(offerOf(undefined)).toMatchObject({ id: "", product: "", unit: "", price: 0, group: undefined });
  });
});

describe("the wrong person's shop", () => {
  const shops = [supplier({ id: "1", owner: "m1" }), supplier({ id: "2", owner: "m2" })];

  it("finds no shop for nobody", () => {
    expect(mySupplier(shops, "")).toBeUndefined();
  });

  it("finds no shop for someone who owns none", () => {
    expect(mySupplier(shops, "m3")).toBeUndefined();
  });

  it("does not match a shop with no owner to an unnamed person", () => {
    expect(mySupplier([supplier({ owner: "" })], "")).toBeUndefined();
  });

  it("takes the newest application when someone applied twice", () => {
    expect(mySupplier([supplier({ id: "old", owner: "m1" }), supplier({ id: "new", owner: "m1" })], "m1")?.id).toBe("new");
  });

  it("counts only the status approved as approved", () => {
    expect(isApproved(supplier({ status: "approved" }))).toBe(true);
    expect(isApproved(supplier({ status: "pending" }))).toBe(false);
    expect(isApproved(supplier({ status: "Approved" }))).toBe(false);
    expect(isApproved(undefined)).toBe(false);
  });
});

describe("words for a price", () => {
  it("names the unit and the bulk price", () => {
    expect(priceWords(priced({ bulkFrom: 10, bulkPrice: 2800 }))).toBe("KES 3,000 a bag · 10 or more KES 2,800");
    expect(buyerPriceWords(priced({ bulkFrom: 10, bulkPrice: 2800 }))).toBe("KES 3,000 a bag · KES 2,800 from 10 bags");
  });

  it("leaves out a bulk price that is half set", () => {
    expect(priceWords(priced({ bulkFrom: 10 }))).toBe("KES 3,000 a bag");
    expect(priceWords(priced({ bulkPrice: 2800 }))).toBe("KES 3,000 a bag");
    expect(buyerPriceWords(priced({ bulkFrom: 10 }))).toBe("KES 3,000 a bag");
  });

  it("writes no unit when there is none", () => {
    expect(priceWords(priced({ unit: "" }))).toBe("KES 3,000");
    expect(buyerPriceWords(priced({ unit: "", bulkFrom: 5, bulkPrice: 1 }))).toBe("KES 3,000 · KES 1 from 5 units");
  });
});

describe("a product slug", () => {
  it("lowercases and joins words with dashes", () => {
    expect(productSlug("  Maize, shelled 2kg! ")).toBe("maize-shelled-2kg");
  });

  it("uses the known slug's own casing", () => {
    expect(productSlug("MAIZE", ["Maize"])).toBe("Maize");
  });

  it("gives an empty slug for words with no letters or digits", () => {
    expect(productSlug("---")).toBe("");
  });
});

describe("who the group waits on", () => {
  it("names nobody when no leader has a name", () => {
    expect(leaderNames([{ actor_id: "a", display_name: "  " }, {}, null])).toEqual([]);
    expect(waitingWords([])).toBe("Waiting on the group coordinator");
  });

  it("names a leader once when listed twice, by id or by name", () => {
    expect(leaderNames([{ actor_id: "a", display_name: "Grace" }, { actor_id: "a", display_name: "Grace A" }, { display_name: "Peter" }, { display_name: "Peter" }])).toEqual(["Grace", "Peter"]);
  });
});

describe("the supply tools", () => {
  const tools = (replies: Record<string, unknown>) =>
    vi.spyOn(mcp, "callTool").mockImplementation((async (_hub: string, tool: string) => {
      const reply = replies[tool];
      if (reply instanceof Error) throw reply;
      return reply ?? {};
    }) as never);

  it("applies with name, area and posts", async () => {
    const spy = tools({ market_apply_poster: { id: "p1", name: "Kisumu Agro", status: "pending" } });
    const made = await mcpSupplyClient.applySupplier({ shop: "Kisumu Agro", area: "Kisumu", sells: "Seed" });
    expect(spy).toHaveBeenCalledWith("", "market_apply_poster", { name: "Kisumu Agro", area: "Kisumu", posts: "Seed" });
    expect(made).toMatchObject({ id: "p1", shop: "Kisumu Agro", status: "pending" });
  });

  it("lets a refused application reach the screen", async () => {
    tools({ market_apply_poster: new mcp.McpError("market_apply_poster: already applied") });
    await expect(mcpSupplyClient.applySupplier({ shop: "a", area: "b", sells: "c" })).rejects.toThrow("already applied");
  });

  it("lists offers for one supplier by poster_id", async () => {
    const spy = tools({ market_list_offers: { items: [{ id: "o1", poster_id: "p1", product_words: "Maize", price: 5 }] } });
    expect(await mcpSupplyClient.listOffers("p1")).toHaveLength(1);
    expect(spy).toHaveBeenCalledWith("", "market_list_offers", { poster_id: "p1" });
  });

  it("lists each product slug once and skips empty ones", async () => {
    tools({ market_list_offers: { items: [{ product: "maize" }, { product: "maize" }, { product: "" }, {}, { product: "beans" }] } });
    expect(await mcpSupplyClient.listProducts!()).toEqual(["maize", "beans"]);
    expect(vi.mocked(mcp.callTool)).toHaveBeenCalledWith("", "market_list_offers", {});
  });

  it("returns no suppliers when the reply has no items", async () => {
    tools({});
    expect(await mcpSupplyClient.listSuppliers()).toEqual([]);
  });

  it("sends offerID and the body, and no id, when updating", async () => {
    const spy = tools({ market_update_offer: { id: "o1" } });
    await mcpSupplyClient.updateOffer(priced({ id: "o1", supplierId: "p1" }));
    expect(spy.mock.calls[0][2]).toMatchObject({ offerID: "o1", poster_id: "p1", product_words: "Maize", price: 3000 });
    expect(spy.mock.calls[0][2]).not.toHaveProperty("id");
  });

  it("skips groups with no id when finding coordinators and survives one group failing", async () => {
    vi.spyOn(mcp, "callTool").mockImplementation((async (_hub: string, tool: string, args: any) => {
      if (tool === "actor_list_my_groups") return { items: [{ id: "g1" }, { id: "" }, {}, { id: "g2" }] };
      if (args.group_id === "g1") throw new Error("down");
      return { items: [{ actor_id: "a", display_name: "Peter" }] };
    }) as never);
    expect(await mcpSupplyClient.listCoordinators!()).toEqual(["Peter"]);
  });
});
