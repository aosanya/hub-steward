import { afterEach, describe, expect, it, vi } from "vitest";
import * as mcp from "../wakala/mcp";
import { mcpMarketClient, productsOf, type Offer } from "./api";

afterEach(() => vi.restoreAllMocks());

const tools = (replies: Record<string, unknown>) =>
  vi.spyOn(mcp, "callTool").mockImplementation((async (_hub: string, tool: string) => {
    const reply = replies[tool];
    if (reply instanceof Error) throw reply;
    return reply ?? {};
  }) as never);

const offer = (over: Partial<Offer>): Offer => ({
  id: "o",
  posterId: "p",
  product: "maize",
  shop: "",
  words: "",
  unit: "",
  price: "100",
  bulkPrice: "",
  bulkFrom: "",
  ...over,
});

describe("products grouped from offers", () => {
  it("counts each shop once however many offers it has", () => {
    const [maize] = productsOf([offer({ id: "1", posterId: "p1" }), offer({ id: "2", posterId: "p1", price: "90" }), offer({ id: "3", posterId: "p2" })]);
    expect(maize.shops).toBe(2);
    expect(maize.fromPrice).toBe("KES 90");
  });

  it("leaves out offers that name no product", () => {
    expect(productsOf([offer({ product: "" })])).toEqual([]);
  });

  it("writes no price when no offer has a usable price", () => {
    expect(productsOf([offer({ price: "" }), offer({ price: "free" })])[0].fromPrice).toBe("");
  });

  it("ignores an unusable price when another offer has one", () => {
    expect(productsOf([offer({ price: "" }), offer({ price: "250" })])[0].fromPrice).toBe("KES 250");
  });

  it("names the product with the words of the cheapest shop's offer", () => {
    const [dap] = productsOf([
      offer({ id: "1", product: "dap-fertiliser-50kg", words: "DAP fertiliser 50 kg bag", price: "4500" }),
      offer({ id: "2", product: "dap-fertiliser-50kg", words: "DAP 50kg", price: "4200" }),
    ]);
    expect(dap.name).toBe("DAP 50kg");
  });

  it("names the product as the data holds it when no offer has words", () => {
    expect(productsOf([offer({ product: "dap-fertiliser-50kg" })])[0].name).toBe("dap-fertiliser-50kg");
    expect(productsOf([offer({ product: "beans" })])[0].name).toBe("beans");
  });
});

describe("what the market tools return", () => {
  it("names a listed product with the words its shop gave the offer", async () => {
    tools({ market_list_offers: { items: [{ id: "o1", poster_id: "p1", product: "urea", product_words: "Urea 50kg", price: 3800 }] } });
    expect((await mcpMarketClient.listProducts()).map((product) => product.name)).toEqual(["Urea 50kg"]);
  });

  it("returns no products when the reply has no items", async () => {
    tools({});
    expect(await mcpMarketClient.listProducts()).toEqual([]);
  });

  it("fills an offer missing every field with empty text", async () => {
    tools({ market_list_offers: { items: [{ product: "maize" }] }, market_list_posters: { items: [] } });
    expect(await mcpMarketClient.listOffers("maize")).toEqual([
      { id: "", posterId: "", product: "maize", shop: "", words: "", unit: "", price: "", bulkPrice: "", bulkFrom: "" },
    ]);
  });

  it("shows no shop name when the poster is not listed", async () => {
    tools({ market_list_offers: { items: [{ id: "o1", poster_id: "gone", product: "maize", price: "5" }] }, market_list_posters: { items: [{ id: "p1", name: "Other" }] } });
    expect((await mcpMarketClient.listOffers("maize"))[0].shop).toBe("");
  });

  it("puts an offer with no price after the priced ones", async () => {
    tools({
      market_list_offers: { items: [{ id: "a", product: "maize" }, { id: "b", product: "maize", price: "9" }, { id: "c", product: "maize", price: 3 }] },
      market_list_posters: { items: [] },
    });
    expect((await mcpMarketClient.listOffers("maize")).map((o) => o.id)).toEqual(["c", "b", "a"]);
  });

  it("shows bulk price and minimum only when the tool sets them", async () => {
    tools({
      market_list_offers: { items: [{ id: "a", product: "maize", price: "9", bulk_min: 0, bulk_price: 0 }, { id: "b", product: "maize", price: "9", bulk_min: 10, bulk_price: 8 }] },
      market_list_posters: { items: [] },
    });
    const [a, b] = await mcpMarketClient.listOffers("maize");
    expect([a.bulkFrom, a.bulkPrice]).toEqual(["", ""]);
    expect([b.bulkFrom, b.bulkPrice]).toEqual(["10", "8"]);
  });

  it("lists only open buy group orders of this product", async () => {
    tools({
      market_list_group_orders: {
        items: [
          { id: "1", product: "maize", state: "open", minimum: 10, price: "5", poster_id: "p" },
          { id: "2", product: "maize", state: "closed" },
          { id: "3", product: "maize", state: "open", direction: "sell" },
          { id: "4", product: "beans", state: "open" },
          { id: "5", product: "maize" },
        ],
      },
    });
    expect(await mcpMarketClient.listGroupOrders("maize")).toEqual([{ id: "1", posterId: "p", product: "maize", price: "5", from: "10" }]);
  });

  it("finds an open group order that sits on the second page of orders", async () => {
    const filler = Array.from({ length: 200 }, (_, n) => ({ id: `g${String(n).padStart(4, "0")}`, product: "beans", state: "open" }));
    const call = vi.spyOn(mcp, "callTool").mockImplementation((async (_hub: string, _tool: string, args: Record<string, unknown>) =>
      args.after ? { items: [{ id: "g0200", product: "maize", state: "open", minimum: 10, price: "5", poster_id: "p" }] } : { items: filler }) as never);
    expect(await mcpMarketClient.listGroupOrders("maize")).toEqual([{ id: "g0200", posterId: "p", product: "maize", price: "5", from: "10" }]);
    expect(call.mock.calls.map((args) => args[2])).toEqual([
      { limit: 200, state: "open" },
      { limit: 200, state: "open", after: "g0199" },
    ]);
  });

  it("lets a failed offers read reach the screen", async () => {
    tools({ market_list_offers: new mcp.McpError("not signed in", true) });
    await expect(mcpMarketClient.listProducts()).rejects.toThrow("not signed in");
  });

  it("lets a failed shop-name read fail the offers read", async () => {
    tools({ market_list_offers: { items: [] }, market_list_posters: new Error("down") });
    await expect(mcpMarketClient.listOffers("maize")).rejects.toThrow("down");
  });
});
