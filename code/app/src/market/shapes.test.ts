import { callTool } from "../wakala/mcp";
import { mcpMarketClient } from "./api";

vi.mock("../wakala/mcp", () => ({ callTool: vi.fn() }));

const offers = {
  items: [
    { id: "o1", poster_id: "p1", product: "urea", product_words: "Urea 50kg", unit_words: "bag", price: 3800, bulk_min: 30, bulk_price: 3700 },
    { id: "o2", poster_id: "p2", product: "urea", product_words: "UREA", price: 3950 },
    { id: "o3", poster_id: "p2", product: "can", product_words: "CAN", price: 3400 },
  ],
};

describe("the market's real shapes", () => {
  it("derives products from the offers' product field", async () => {
    (callTool as any).mockResolvedValue(offers);
    const products = await mcpMarketClient.listProducts();
    expect(callTool).toHaveBeenCalledWith("", "market_list_offers", {});
    expect(products.map((p) => [p.id, p.name, p.shops])).toEqual([["urea", "Urea 50kg", 2], ["can", "CAN", 1]]);
  });

  it("writes the lowest price of each product with the currency and a thousands separator", async () => {
    (callTool as any).mockResolvedValue(offers);
    const products = await mcpMarketClient.listProducts();
    expect(products.map((p) => [p.id, p.fromPrice])).toEqual([["urea", "KES 3,800"], ["can", "KES 3,400"]]);
  });

  it("keeps only the product's offers, cheapest first, with the shop's name, unit, bulk_min and bulk_price", async () => {
    (callTool as any).mockImplementation(async (_hub: string, tool: string) =>
      tool === "market_list_posters"
        ? { items: [{ id: "p1", name: "Kisumu Agro Supplies" }, { id: "p2", name: "Siaya Farm Stores" }] }
        : { items: [...offers.items].reverse() },
    );
    const list = await mcpMarketClient.listOffers("urea");
    expect(callTool).toHaveBeenCalledWith("", "market_list_posters", {});
    expect(list.map((o) => o.id)).toEqual(["o1", "o2"]);
    expect(list[0]).toMatchObject({ shop: "Kisumu Agro Supplies", unit: "bag", words: "Urea 50kg", bulkPrice: "3700", bulkFrom: "30", posterId: "p1" });
  });

  it("keeps the open group orders for the product", async () => {
    (callTool as any).mockResolvedValue({
      items: [
        { id: "g1", poster_id: "p1", product: "urea", price: 3600, minimum: 20, state: "open", direction: "buy" },
        { id: "g2", poster_id: "p1", product: "urea", price: 3600, minimum: 20, state: "closed", direction: "buy" },
        { id: "g3", poster_id: "p1", product: "maize", price: 1, minimum: 20, state: "open", direction: "buy" },
      ],
    });
    const orders = await mcpMarketClient.listGroupOrders("urea");
    expect(orders.map((o) => o.id)).toEqual(["g1"]);
    expect(orders[0].from).toBe("20");
  });
});
