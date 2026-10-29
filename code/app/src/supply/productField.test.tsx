import { correctedGroup, mcpSupplyClient, offerOf, productSlug } from "./api";
import { mcpSellClient } from "../sell/now/api";
import * as mcp from "../wakala/mcp";

afterEach(() => vi.restoreAllMocks());

const shop = { id: "p1", name: "Kisumu Agro Supplies", status: "approved" };

const rawOffer = (id: string, words: string, product: string) => ({
  id,
  poster_id: "p1",
  product_words: words,
  product,
  unit_words: "bag",
  price: 900,
});

describe("the product slug comes from the offer's own product field", () => {
  it("does not treat Maize seed 2kg as the maize product", () => {
    expect(productSlug("Maize seed 2kg", ["maize", "beans"])).toBe("maize-seed-2kg");
    expect(productSlug("Maize seed 2kg", ["maize", "beans"])).not.toBe("maize");
  });

  it("treats an offer whose product field is maize as the maize product, whatever its words", () => {
    expect(offerOf(rawOffer("o1", "Maize seed 2kg", "maize")).group).toBe("maize");
    expect(offerOf(rawOffer("o2", "Dry maize", "maize")).group).toBe("maize");
  });

  it("leaves the group empty when the offer has no product field", () => {
    expect(offerOf(rawOffer("o3", "Maize seed 2kg", "")).group).toBeUndefined();
  });

  it("sends the slug the form chose and nothing guessed from the title", async () => {
    const call = vi.spyOn(mcp, "callTool").mockResolvedValue({});
    await mcpSupplyClient.createOffer("p1", {
      product: "Maize seed 2kg",
      group: productSlug("Maize seed 2kg", ["maize"]),
      unit: "bag",
      price: 900,
      bulkFrom: 0,
      bulkPrice: 0,
    });
    expect(call).toHaveBeenCalledWith("", "market_create_offer", expect.objectContaining({ product: "maize-seed-2kg" }));
  });

  it("keeps Maize seed 2kg off the maize sale page and keeps an offer filed as maize on it", async () => {
    vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, tool) => {
      if (tool === "market_list_posters") return { items: [shop] };
      if (tool === "market_list_offers") {
        return { items: [rawOffer("o1", "Maize seed 2kg", "maize-seed-2kg"), rawOffer("o2", "Maize, shelled", "maize")] };
      }
      return {};
    });
    const prices = await mcpSellClient.listPrices("maize");
    expect(prices.map((price) => price.id)).toEqual(["o2"]);
  });

  it("corrects an offer saved under the old maize slug to the current slug when it is saved again", async () => {
    expect(correctedGroup("Maize seed 2kg", "maize")).toBe("maize-seed-2kg");
    expect(correctedGroup("Maize, shelled", "maize")).toBe("maize-shelled");
    expect(correctedGroup("Maize", "maize")).toBe("maize");
    expect(correctedGroup("Dry maize", "maize")).toBe("maize");
    expect(correctedGroup("Maize seed", undefined)).toBeUndefined();
    const call = vi.spyOn(mcp, "callTool").mockResolvedValue({});
    const stale = offerOf(rawOffer("o1", "Maize seed 2kg", "maize"));
    await mcpSupplyClient.updateOffer(stale);
    expect(call).toHaveBeenCalledWith("", "market_update_offer", expect.objectContaining({ product: "maize-seed-2kg" }));
  });
});
