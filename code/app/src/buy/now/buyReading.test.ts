import * as mcp from "../../wakala/mcp";
import { buyOfferOf, buyOrderOf, mcpBuyNowClient, offerWordsOf, orderTotal } from "./api";

afterEach(() => vi.restoreAllMocks());

const answering = (tables: Record<string, unknown>, seen: [string, any][] = []) =>
  vi.spyOn(mcp, "callTool").mockImplementation(async (_hub: string, name: string, args: any) => {
    seen.push([name, args]);
    return tables[name] ?? {};
  });

const posters = { market_list_posters: { items: [{ id: "p1", name: "Kisumu Agro Supplies" }] } };
const offers = { market_list_offers: { items: [{ id: "o1", poster_id: "p1", product: "urea", product_words: "Urea 50kg", unit_words: "bag", price: "4100" }] } };

describe("reading an offer or an order", () => {
  it("reads an offer with the shop's name and a price that is a number", () => {
    expect(buyOfferOf({ id: "o1", poster_id: "p1", product: "urea", product_words: "Urea 50kg", unit_words: "bag", price: "4100" }, "Kisumu Agro Supplies")).toEqual({
      id: "o1",
      posterId: "p1",
      shop: "Kisumu Agro Supplies",
      words: "Urea 50kg",
      product: "urea",
      unit: "bag",
      unitPrice: 4100,
    });
  });

  it("reads an empty offer as blanks and zero", () => {
    expect(buyOfferOf(undefined)).toEqual({ id: "", posterId: "", shop: "", words: "", product: "", unit: "", unitPrice: 0 });
  });

  it("names an order's product in the shop's words, else by its code, and counts paid only when it is true", () => {
    expect(buyOrderOf({ id: "or1", product: "urea", paid: true }, "S", "Urea 50kg", "bag")).toMatchObject({ product: "Urea 50kg", unit: "bag", paid: true, shop: "S" });
    expect(buyOrderOf({ id: "or1", product: "urea", paid: "yes" }).product).toBe("urea");
    expect(buyOrderOf({ id: "or1", paid: "yes" }).paid).toBe(false);
  });

  it("totals quantity times unit price", () => {
    expect(orderTotal(buyOrderOf({ quantity: 3, unit_price: 4100 }))).toBe(12300);
  });
});

describe("the buy-now client", () => {
  it("reads an offer with its shop, and says when the offer is not there", async () => {
    answering({ ...offers, ...posters });
    expect(await mcpBuyNowClient.getOffer("o1")).toMatchObject({ id: "o1", shop: "Kisumu Agro Supplies", words: "Urea 50kg" });
    await expect(mcpBuyNowClient.getOffer("o9")).rejects.toThrow("offer not found");
  });

  it("buys with the quantity, and the shop's yes when there is one, then reads the order with the shop and the offer's words", async () => {
    const seen: [string, any][] = [];
    answering({ ...offers, ...posters, market_buy_now: { id: "or1", poster_id: "p1", offer_id: "o1", quantity: 2, unit_price: 4100, state: "placed" } }, seen);
    const order = await mcpBuyNowClient.buyNow("o1", 2, "y1");
    expect(seen[0]).toEqual(["market_buy_now", { offerID: "o1", quantity: 2, yes_id: "y1" }]);
    expect(order).toMatchObject({ id: "or1", shop: "Kisumu Agro Supplies", product: "Urea 50kg", unit: "bag", quantity: 2 });
  });

  it("leaves the yes out of the call when there is none", async () => {
    const seen: [string, any][] = [];
    answering({ market_buy_now: { id: "or1" } }, seen);
    await mcpBuyNowClient.buyNow("o1", 2);
    expect(seen[0][1]).toEqual({ offerID: "o1", quantity: 2 });
  });

  it("reads an order by its id and cancels it by its id", async () => {
    const seen: [string, any][] = [];
    answering({ market_get_order: { id: "or1" }, market_cancel_order: { id: "or1", state: "cancelled" } }, seen);
    expect((await mcpBuyNowClient.getOrder("or1")).id).toBe("or1");
    expect((await mcpBuyNowClient.cancelOrder("or1")).state).toBe("cancelled");
    expect(seen.filter(([name]) => name !== "market_list_posters" && name !== "market_list_offers")).toEqual([
      ["market_get_order", { orderID: "or1" }],
      ["market_cancel_order", { orderID: "or1" }],
    ]);
  });

  it("still shows an order when the offer list cannot be read", async () => {
    vi.spyOn(mcp, "callTool").mockImplementation(async (_hub: string, name: string) => {
      if (name === "market_list_offers") throw new Error("down");
      if (name === "market_get_order") return { id: "or1", offer_id: "o1", product: "urea", poster_id: "" };
      return {};
    });
    expect(await mcpBuyNowClient.getOrder("or1")).toMatchObject({ id: "or1", product: "urea", unit: "", shop: "" });
  });

  it("reads the offer's words, or none for an order with no offer", async () => {
    const seen: [string, any][] = [];
    answering(offers, seen);
    expect(await offerWordsOf("o1")).toBe("Urea 50kg");
    expect(await offerWordsOf("")).toBe("");
    expect(seen.length).toBe(1);
  });
});
