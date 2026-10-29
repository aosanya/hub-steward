import type { Product } from "../../market/api";
import type { BuyerPrice, GroupSale, SellClient } from "../../sell/now/api";
import type { Block } from "../blocks/types";
import { groupCard, joinGroupPrompt, priceCard, sellNowPrompt, sellSource } from "./sellSource";

const price = (id: string, buyerId: string, buyer: string, amount: number): BuyerPrice => ({
  id,
  buyerId,
  buyer,
  product: "maize",
  words: "Dry maize 90kg",
  unit: "bag",
  price: amount,
  bulkPrice: 4350,
  bulkFrom: 100,
});

const group: GroupSale = { id: "g1", buyerId: "b1", product: "maize", price: 4350, from: 100 };

const prices = [
  price("o1", "b1", "Kisumu Grain Traders", 4200),
  price("o2", "b2", "Siaya Millers", 4000),
  price("o3", "b3", "Bondo Feeds", 3900),
];

const dryMaize: Product = { id: "maize", name: "Dry maize 90kg", shops: 3, fromPrice: "KES 3,900" };

const product = (id: string): Product => ({ id, name: id, shops: 1, fromPrice: "KES 1,000" });

const clientOf = (overrides: Partial<SellClient> = {}): SellClient => ({
  listProducts: vi.fn().mockResolvedValue([dryMaize]),
  listPrices: vi.fn().mockResolvedValue(prices),
  listGroupSales: vi.fn().mockResolvedValue([group]),
  sellNow: vi.fn(),
  getSale: vi.fn(),
  bookSale: vi.fn(),
  ...overrides,
});

const listing = (...listed: Product[]) => clientOf({ listProducts: vi.fn().mockResolvedValue(listed) });

const me = (text: string): Block => ({ kind: "text", from: "me", text });

const cardsOf = (blocks: Block[]) => blocks.find((block) => block.kind === "cards");

const textsOf = (blocks: Block[]) => blocks.flatMap((block) => (block.kind === "text" ? [block.text] : []));

describe("sellSource", () => {
  it("opens with a greeting, the produce to pick and the best buyers", async () => {
    const blocks = await sellSource(clientOf()).opening();
    expect(textsOf(blocks)).toEqual(["What do you want to sell?"]);
    expect(blocks[1]).toEqual({ kind: "prompts", prompts: ["Dry maize 90kg"] });
    const cards = cardsOf(blocks);
    expect(cards?.kind === "cards" && cards.cards[0].title).toBe("Kisumu Grain Traders");
  });

  it("shows one buyer and keeps the rest behind Show other buyers", async () => {
    const blocks = await sellSource(clientOf()).opening();
    const cards = cardsOf(blocks);
    expect(cards?.kind === "cards" && cards.shown).toBe(1);
    expect(cards?.kind === "cards" && cards.cards).toHaveLength(3);
    expect(cards?.kind === "cards" && cards.more).toBe("Show other buyers");
  });

  it("keeps the failure text after the greeting when the prices cannot load", async () => {
    const client = clientOf({ listPrices: vi.fn().mockRejectedValue(new Error("down")) });
    const blocks = await sellSource(client).opening();
    expect(textsOf(blocks)).toEqual(["What do you want to sell?", "The buyers' prices could not be loaded. Try again in a moment."]);
    expect(blocks[1]).toEqual({ kind: "prompts", prompts: ["Dry maize 90kg"] });
    expect(cardsOf(blocks)).toBeUndefined();
  });

  it("says no buyer has posted a price after the greeting when none exists", async () => {
    const blocks = await sellSource(clientOf({ listPrices: vi.fn().mockResolvedValue([]) })).opening();
    expect(textsOf(blocks)).toEqual(["What do you want to sell?", "No buyer has posted a price for maize yet."]);
  });

  it("keeps the product she typed when she taps Sell now", async () => {
    const beans = { ...prices[0], id: "o9", product: "beans" };
    const listPrices = vi.fn((product: string) => Promise.resolve(product === "beans" ? [beans] : prices));
    const blocks = await sellSource(clientOf({ listPrices })).reply(sellNowPrompt, [me("Beans")]);
    expect(listPrices).toHaveBeenCalledWith("beans");
    const cards = cardsOf(blocks);
    expect(cards?.kind === "cards" && cards.cards.map((card) => card.buttons[0].to)).toEqual(["/sell/beans/now/o9"]);
  });

  it("keeps the product she typed through a Sell now then Join a group sale", async () => {
    const listGroupSales = vi.fn().mockResolvedValue([]);
    const thread = [me("Beans"), me(sellNowPrompt)];
    const blocks = await sellSource(clientOf({ listGroupSales })).reply(joinGroupPrompt, thread);
    expect(listGroupSales).toHaveBeenCalledWith("beans");
    expect(textsOf(blocks)).toEqual(["No group sale is open for beans."]);
  });

  it("says no buyer prices the product she typed instead of showing maize", async () => {
    const listPrices = vi.fn((product: string) => Promise.resolve(product === "maize" ? prices : []));
    const blocks = await sellSource(clientOf({ listPrices })).reply(sellNowPrompt, [me("beans")]);
    expect(textsOf(blocks)).toEqual(["No buyer has posted a price for beans yet."]);
    expect(cardsOf(blocks)).toBeUndefined();
  });

  it("uses the produce she typed last", async () => {
    const client = clientOf();
    await sellSource(client).reply(sellNowPrompt, [me("beans"), me(sellNowPrompt), me("maize")]);
    expect(client.listPrices).toHaveBeenLastCalledWith("maize");
  });

  it("falls back to the first product the buyers' prices carry when she has typed nothing yet", async () => {
    const client = listing(product("sorghum"), product("maize"));
    await sellSource(client).reply(sellNowPrompt, []);
    expect(client.listPrices).toHaveBeenCalledWith("sorghum");
  });

  it("offers the products the buyers' prices carry, named as the list names them, and prices the first of them", async () => {
    const client = listing({ ...product("sorghum"), name: "Red sorghum 50kg" }, product("beans"));
    const blocks = await sellSource(client).opening();
    expect(blocks[1]).toEqual({ kind: "prompts", prompts: ["Red sorghum 50kg", "beans"] });
    expect(client.listPrices).toHaveBeenCalledWith("sorghum");
  });

  it("names no product when no buyer has posted a price", async () => {
    const client = listing();
    const blocks = await sellSource(client).opening();
    expect(textsOf(blocks)).toEqual(["What do you want to sell?", "No buyer has posted a price yet."]);
    expect(blocks.some((block) => block.kind === "prompts")).toBe(false);
    expect(client.listPrices).not.toHaveBeenCalled();
  });

  it("says the prices could not be loaded when the products could not be read", async () => {
    const client = clientOf({ listProducts: vi.fn().mockRejectedValue(new Error("down")) });
    const blocks = await sellSource(client).opening();
    expect(textsOf(blocks)).toEqual(["What do you want to sell?", "The buyers' prices could not be loaded. Try again in a moment."]);
  });

  it("offers the products the buyers' prices carry after a product nobody prices", async () => {
    const client = listing(product("sorghum"));
    (client.listPrices as any).mockResolvedValue([]);
    const blocks = await sellSource(client).reply("beans", []);
    expect(blocks[1]).toEqual({ kind: "prompts", prompts: ["sorghum"] });
  });

  it("prices the product whose name she tapped, not the name as a key", async () => {
    const client = clientOf();
    await sellSource(client).reply("Dry maize 90kg", []);
    expect(client.listPrices).toHaveBeenCalledWith("maize");
  });

  it("keeps the product whose name she tapped when she taps Sell now", async () => {
    const client = clientOf();
    await sellSource(client).reply(sellNowPrompt, [me("Dry maize 90kg")]);
    expect(client.listPrices).toHaveBeenCalledWith("maize");
  });

  it("keeps the product whose name she tapped through a Sell now then Join a group sale", async () => {
    const client = clientOf();
    await sellSource(client).reply(joinGroupPrompt, [me("Dry maize 90kg"), me(sellNowPrompt)]);
    expect(client.listGroupSales).toHaveBeenCalledWith("maize");
  });

  it("answers a produce with the best buyer, a group sale note and both actions", async () => {
    const blocks = await sellSource(clientOf()).reply("Maize", []);
    expect(textsOf(blocks)).toEqual(["Kisumu Grain Traders pays the most for Dry maize 90kg. A group sale is also open."]);
    expect(blocks[2]).toEqual({ kind: "prompts", prompts: [sellNowPrompt, joinGroupPrompt] });
  });

  it("offers only Sell now when no group sale is open", async () => {
    const blocks = await sellSource(clientOf({ listGroupSales: vi.fn().mockResolvedValue([]) })).reply("Maize", []);
    expect(blocks[2]).toEqual({ kind: "prompts", prompts: [sellNowPrompt] });
  });

  it("says so when no buyer has posted a price", async () => {
    const blocks = await sellSource(clientOf({ listPrices: vi.fn().mockResolvedValue([]) })).reply("sorghum", []);
    expect(textsOf(blocks)).toEqual(["No buyer has posted a price for sorghum yet."]);
    expect(cardsOf(blocks)).toBeUndefined();
  });

  it("says so when the prices cannot load", async () => {
    const client = clientOf({ listPrices: vi.fn().mockRejectedValue(new Error("down")) });
    const blocks = await sellSource(client).reply("Maize", []);
    expect(textsOf(blocks)).toEqual(["The buyers' prices could not be loaded. Try again in a moment."]);
  });

  it("sends Sell now to the existing Sell now page of each buyer", async () => {
    const blocks = await sellSource(clientOf()).reply(sellNowPrompt, [me("Maize")]);
    const cards = cardsOf(blocks);
    expect(cards?.kind === "cards" && cards.cards.map((card) => card.buttons)).toEqual([
      [{ label: "Sell now", to: "/sell/maize/now/o1" }],
      [{ label: "Sell now", to: "/sell/maize/now/o2" }],
      [{ label: "Sell now", to: "/sell/maize/now/o3" }],
    ]);
    expect(cards?.kind === "cards" && cards.shown).toBe(1);
  });

  it("sends Join a group sale to the group sale page, one sale shown at a time", async () => {
    const second: GroupSale = { ...group, id: "g2", buyerId: "b2" };
    const client = clientOf({ listGroupSales: vi.fn().mockResolvedValue([group, second]) });
    const blocks = await sellSource(client).reply(joinGroupPrompt, [me("Maize")]);
    const cards = cardsOf(blocks);
    expect(cards?.kind === "cards" && cards.cards.map((card) => card.buttons[0].to)).toEqual(["/sell/group/g1", "/sell/group/g2"]);
    expect(cards?.kind === "cards" && cards.cards[0].lines).toEqual([
      "Group sale open KES 4,350 a bag from 100 bags",
      "Kisumu Grain Traders",
    ]);
    expect(cards?.kind === "cards" && cards.shown).toBe(1);
    expect(cards?.kind === "cards" && cards.more).toBe("Show other group sales");
  });

  it("says so when no group sale is open", async () => {
    const client = clientOf({ listGroupSales: vi.fn().mockResolvedValue([]) });
    const blocks = await sellSource(client).reply(joinGroupPrompt, []);
    expect(textsOf(blocks)).toEqual(["No group sale is open for Dry maize 90kg."]);
  });

  it("asks the client for the produce she picked last", async () => {
    const client = clientOf();
    await sellSource(client).reply(sellNowPrompt, [me("maize")]);
    expect(client.listPrices).toHaveBeenCalledWith("maize");
  });

  it("builds a price card with the bulk price, the group line and the two links", () => {
    expect(priceCard(prices[0], group)).toEqual({
      id: "price-o1",
      title: "Kisumu Grain Traders",
      lines: ["Dry maize 90kg", "KES 4,200 a bag", "Bulk price KES 4,350 a bag from 100 bags", "Group sale open KES 4,350 a bag from 100 bags"],
      buttons: [
        { label: "Sell now", to: "/sell/maize/now/o1" },
        { label: "Sell together", to: "/sell/group/g1" },
      ],
    });
  });

  it("titles a group card with the product name it was given", () => {
    expect(groupCard(group, "Kisumu Grain Traders", "Dry maize 90kg").title).toBe("Dry maize 90kg group sale");
  });

  it("titles each group sale with the words of the buyers' prices for the product", async () => {
    const blocks = await sellSource(clientOf()).reply(joinGroupPrompt, [me("maize")]);
    const cards = cardsOf(blocks);
    expect(cards?.kind === "cards" && cards.cards[0].title).toBe("Dry maize 90kg group sale");
  });

  it("builds a group card without a buyer line when the buyer is unknown", () => {
    expect(groupCard(group, "", "Dry maize 90kg").lines).toEqual(["Group sale open KES 4,350 a bag from 100 bags"]);
  });

  it("has nothing to fill in", async () => {
    const blocks = await sellSource(clientOf()).submit({ kind: "prompts", prompts: [] }, {});
    expect(textsOf(blocks)).toEqual(["There is nothing to fill in here."]);
  });
});
