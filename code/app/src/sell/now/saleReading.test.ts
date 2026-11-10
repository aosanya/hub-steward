import * as mcp from "../../wakala/mcp";
import { kes } from "../../supply/api";
import {
  askedBags,
  bulkWords,
  groupSaleLine,
  groupSaleOf,
  mcpSellClient,
  priceOf,
  readSale,
  readSales,
  saleFrom,
  saleQuestion,
  saleTotal,
  statusOf,
  type BuyerPrice,
  type Sale,
} from "./api";

afterEach(() => vi.restoreAllMocks());

const names = new Map([["b1", "Kisumu Grain Traders"]]);

const ask = { id: "a1", offer_id: "o1", poster_id: "b1", product: "maize", question: "40 bags of maize", answer: "waiting", kind: "sale" };
const offer = { id: "o1", poster_id: "b1", product: "maize", product_words: "Dry maize 90kg", unit_words: "bag", price: 4200, bulk_min: 50, bulk_price: 4000 };

const sale = (over: Partial<Sale> = {}): Sale => ({
  id: "a1",
  orderId: "",
  offerId: "o1",
  yesId: "",
  answer: "waiting",
  buyerId: "b1",
  buyer: "Kisumu Grain Traders",
  product: "maize",
  unit: "bag",
  quantity: 40,
  unitPrice: 4200,
  state: "asked",
  promisedDate: "",
  ...over,
});

const answering = (tables: Record<string, unknown>, seen: [string, any][] = []) =>
  vi.spyOn(mcp, "callTool").mockImplementation(async (_hub: string, name: string, args: any) => {
    seen.push([name, args]);
    return tables[name] ?? {};
  });

describe("what a sale line says", () => {
  it("takes the first number in the question as the bags asked, and 0 when there is none", () => {
    expect(askedBags("40 bags of maize")).toBe(40);
    expect(askedBags("Maize, 12 bags or 5")).toBe(12);
    expect(askedBags("some maize")).toBe(0);
  });

  it("words the question with the quantity, its unit and the product", () => {
    expect(saleQuestion(1, "bag", "Dry maize")).toBe("1 bag of Dry maize");
    expect(saleQuestion(40, "bag", "Dry maize")).toBe("40 bags of Dry maize");
    expect(saleQuestion(3, "", "Dry maize")).toBe("3 of Dry maize");
  });

  it("totals quantity times unit price", () => {
    expect(saleTotal(sale({ quantity: 40, unitPrice: 4200 }))).toBe(168000);
  });

  it("says Cancelled before anything else, then No, then Yes once a date is promised, else Waiting", () => {
    expect(statusOf(sale({ state: "cancelled", answer: "yes", promisedDate: "2026-11-06" }))).toBe("Cancelled");
    expect(statusOf(sale({ answer: "no", promisedDate: "2026-11-06" }))).toBe("No");
    expect(statusOf(sale({ answer: "yes", promisedDate: "2026-11-06" }))).toBe("Yes");
    expect(statusOf(sale())).toBe("Waiting");
  });

  it("words an open group sale with a singular or plural bag", () => {
    expect(groupSaleLine({ id: "g", buyerId: "b1", product: "maize", price: 4100, from: 1 })).toBe(`Group sale open ${kes(4100)} a bag from 1 bag`);
    expect(groupSaleLine({ id: "g", buyerId: "b1", product: "maize", price: 4100, from: 20 })).toBe(`Group sale open ${kes(4100)} a bag from 20 bags`);
  });

  it("words a bulk price only when both the price and the quantity are set", () => {
    const priced: BuyerPrice = { id: "o1", buyerId: "b1", buyer: "K", product: "maize", words: "", unit: "bag", price: 4200, bulkPrice: 4000, bulkFrom: 50 };
    expect(bulkWords(priced)).toBe(`Bulk price ${kes(4000)} a bag from 50 bags`);
    expect(bulkWords({ ...priced, bulkPrice: 0 })).toBe("");
    expect(bulkWords({ ...priced, bulkFrom: 0 })).toBe("");
  });
});

describe("reading the hub's rows", () => {
  it("reads a buyer's price with the buyer's name and zeros for what is missing", () => {
    expect(priceOf({ id: "o1", poster_id: "b1", product: "maize", product_words: "Dry maize", unit_words: "bag", price: "4200" }, names)).toEqual({
      id: "o1",
      buyerId: "b1",
      buyer: "Kisumu Grain Traders",
      product: "maize",
      words: "Dry maize",
      unit: "bag",
      price: 4200,
      bulkPrice: 0,
      bulkFrom: 0,
    });
    expect(priceOf(undefined, names).buyer).toBe("");
  });

  it("reads a group sale's minimum as where the price starts", () => {
    expect(groupSaleOf({ id: "g1", poster_id: "b1", product: "maize", price: 4100, minimum: "20" })).toEqual({ id: "g1", buyerId: "b1", product: "maize", price: 4100, from: 20 });
  });

  it("prices an ask at the bulk price from the bulk quantity, else the list price", () => {
    expect(saleFrom(ask, names, [offer], [], []).unitPrice).toBe(4200);
    expect(saleFrom({ ...ask, question: "60 bags of maize" }, names, [offer], [], []).unitPrice).toBe(4000);
    expect(saleFrom({ ...ask, question: "50 bags of maize" }, names, [offer], [], []).unitPrice).toBe(4000);
  });

  it("takes quantity, price, state and date from the order once the buyer said yes", () => {
    const yes = { id: "y1", ask_id: "a1", date: "2026-11-05" };
    const order = { id: "or1", yes_id: "y1", quantity: 45, unit_price: 4100, state: "placed", promised_date: "2026-11-06" };
    expect(saleFrom({ ...ask, answer: "yes" }, names, [offer], [yes], [order])).toMatchObject({
      orderId: "or1",
      yesId: "y1",
      quantity: 45,
      unitPrice: 4100,
      state: "placed",
      promisedDate: "2026-11-06",
      buyer: "Kisumu Grain Traders",
      unit: "bag",
    });
  });

  it("falls back to the buyer's promised date before an order exists, and calls a withdrawn ask cancelled", () => {
    const yes = { id: "y1", ask_id: "a1", date: "2026-11-05" };
    expect(saleFrom({ ...ask, answer: "yes" }, names, [offer], [yes], [])).toMatchObject({ orderId: "", state: "asked", promisedDate: "2026-11-05" });
    expect(saleFrom({ ...ask, answer: "withdrawn" }, names, [offer], [], []).state).toBe("cancelled");
  });

  it("copes with rows that are missing", () => {
    expect(saleFrom(undefined, names, [], [], [])).toMatchObject({ id: "", buyer: "", quantity: 0, unitPrice: 0, state: "asked" });
  });
});

describe("reading sales from the hub", () => {
  const tables = {
    market_list_asks: { items: [ask, { ...ask, id: "a2", kind: "question" }, { ...ask, id: "a3", answer: "withdrawn" }] },
    market_list_posters: { items: [{ id: "b1", name: "Kisumu Grain Traders" }] },
    market_list_offers: { items: [offer] },
    market_list_yeses: { items: [] },
    market_list_orders: { items: [] },
  };

  it("lists only the asks of kind sale, with the buyer's name", async () => {
    answering(tables);
    const sales = await readSales();
    expect(sales.map((one) => one.id)).toEqual(["a1", "a3"]);
    expect(sales[0].buyer).toBe("Kisumu Grain Traders");
    expect(statusOf(sales[1])).toBe("Cancelled");
  });

  it("reads nothing from a hub that answers with no list", async () => {
    answering({});
    expect(await readSales()).toEqual([]);
  });

  it("finds one sale by its id and says when it is not there", async () => {
    answering(tables);
    expect((await readSale("a3")).id).toBe("a3");
    await expect(readSale("nope")).rejects.toThrow("sale not found");
  });
});

describe("the sell client", () => {
  const prices = {
    market_list_posters: { items: [{ id: "b1", name: "Kisumu Grain Traders", status: "approved" }, { id: "b2", name: "Nakuru Mills", status: "pending" }] },
    market_list_offers: {
      items: [
        { id: "o1", poster_id: "b1", product: "maize", product_words: "Dry maize", unit_words: "bag", price: 4200 },
        { id: "o2", poster_id: "b1", product: "beans", product_words: "Beans", unit_words: "bag", price: 9000 },
        { id: "o3", poster_id: "b2", product: "maize", product_words: "Dry maize", unit_words: "bag", price: 5000 },
        { id: "o4", poster_id: "b1", product: "maize", product_words: "Dry maize", unit_words: "bag", price: 4500 },
      ],
    },
  };

  it("lists prices for one product from approved buyers only, best price first", async () => {
    answering(prices);
    const list = await mcpSellClient.listPrices("maize");
    expect(list.map((one) => one.id)).toEqual(["o4", "o1"]);
    expect(list.every((one) => one.buyer === "Kisumu Grain Traders")).toBe(true);
  });

  it("lists the products approved buyers pay for, without the pending buyer's offers", async () => {
    answering({ ...prices, market_list_offers: { items: [prices.market_list_offers.items[2]] } });
    expect(await mcpSellClient.listProducts()).toEqual([]);
  });

  it("makes a request, then an ask of kind sale for the offer, then reads the sale back", async () => {
    const seen: [string, any][] = [];
    answering(
      {
        market_list_offers: { items: [offer] },
        market_create_wanted: { id: "r1" },
        market_ask: { id: "a1" },
        market_list_asks: { items: [ask] },
        market_list_posters: { items: [{ id: "b1", name: "Kisumu Grain Traders" }] },
      },
      seen,
    );
    const made = await mcpSellClient.sellNow("o1", 40);
    expect(seen.find(([name]) => name === "market_create_wanted")?.[1]).toEqual({ wanted: "40 bags of Dry maize 90kg", quantity: 40 });
    expect(seen.find(([name]) => name === "market_ask")?.[1]).toMatchObject({
      poster_id: "b1",
      offer_id: "o1",
      request_id: "r1",
      kind: "sale",
      product: "maize",
      question: "40 bags of Dry maize 90kg",
    });
    expect(made.id).toBe("a1");
  });

  it("says the offer is gone when it is not in the hub's list, and sends no ask", async () => {
    const seen: [string, any][] = [];
    answering({ market_list_offers: { items: [] } }, seen);
    await expect(mcpSellClient.sellNow("o9", 5)).rejects.toThrow("offer not found");
    expect(seen.map(([name]) => name)).toEqual(["market_list_offers"]);
  });

  it("books a sale as a buy-now of its quantity against the buyer's yes", async () => {
    const seen: [string, any][] = [];
    answering({}, seen);
    await mcpSellClient.bookSale(sale({ quantity: 45, yesId: "y1" }));
    expect(seen).toEqual([["market_buy_now", { offerID: "o1", quantity: 45, yes_id: "y1" }]]);
  });

  it("books a sale with no yes without a yes_id", async () => {
    const seen: [string, any][] = [];
    answering({}, seen);
    await mcpSellClient.bookSale(sale());
    expect(seen[0][1]).toEqual({ offerID: "o1", quantity: 40 });
  });
});
