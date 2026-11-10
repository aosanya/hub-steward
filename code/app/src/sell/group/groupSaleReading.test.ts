import * as mcp from "../../wakala/mcp";
import * as supply from "../../supply/api";
import { answeredAsks, askPrice, buyerAskOf, mcpBuyerAskClient, waitingAsks, type BuyerAsk } from "./buyerAsksApi";
import { isOpenSale, mcpSaleClient, ownLine, saleOf, type Sale } from "./saleApi";

afterEach(() => vi.restoreAllMocks());

const sale = (over: Partial<Sale> = {}): Sale => ({
  id: "g1",
  product: "maize",
  productWords: "Dry maize",
  buyer: "Kisumu Grain Traders",
  price: 4100,
  minimum: 20,
  state: "open",
  total: 0,
  count: 0,
  lines: [{ picker: "amina", quantity: 5 }],
  ...over,
});

describe("a group sale", () => {
  it("is open until it is closed or cancelled", () => {
    expect(isOpenSale(sale({ state: "open" }))).toBe(true);
    expect(isOpenSale(sale({ state: "" }))).toBe(true);
    expect(isOpenSale(sale({ state: "closed" }))).toBe(false);
    expect(isOpenSale(sale({ state: "cancelled" }))).toBe(false);
  });

  it("finds a member's own line, and none for nobody or another member", () => {
    expect(ownLine(sale(), "amina")).toEqual({ picker: "amina", quantity: 5 });
    expect(ownLine(sale(), "")).toBeUndefined();
    expect(ownLine(sale(), "otieno")).toBeUndefined();
  });

  it("reads a row with its lines, the buyer given and the product named by the offers", () => {
    const read = saleOf(
      { id: "g1", poster_id: "b1", product: "maize", price: "4100", minimum: 20, state: "open", total: 5, count: 1, promised_date: "2026-11-09", note: "Bring sacks", lines: [{ picker: "amina", quantity: "5" }, null] },
      "Kisumu Grain Traders",
      [{ posterId: "b1", product: "maize", words: "Dry maize 90kg", price: "4100" }],
    );
    expect(read).toMatchObject({ id: "g1", buyer: "Kisumu Grain Traders", price: 4100, minimum: 20, total: 5, count: 1, date: "2026-11-09", note: "Bring sacks", posterId: "b1" });
    expect(read.lines).toEqual([
      { picker: "amina", quantity: 5 },
      { picker: "", quantity: 0 },
    ]);
  });

  it("reads an empty row as blanks and no lines", () => {
    expect(saleOf(undefined)).toMatchObject({ id: "", price: 0, lines: [], buyer: "" });
  });
});

describe("the sale client", () => {
  const order = { id: "g1", poster_id: "b1", product: "maize", price: 4100, minimum: 20, state: "open", lines: [] };

  const answering = (seen: [string, any][] = [], suppliers: unknown = [{ id: "b1", shop: "Kisumu Grain Traders" }]) => {
    vi.spyOn(supply.mcpSupplyClient, "listSuppliers").mockImplementation(async () => {
      if (suppliers instanceof Error) throw suppliers;
      return suppliers as any;
    });
    vi.spyOn(mcp, "callTool").mockImplementation(async (_hub: string, name: string, args: any) => {
      seen.push([name, args]);
      return name === "market_get_group_order" ? order : {};
    });
  };

  it("reads a group order with the buyer's shop name", async () => {
    const seen: [string, any][] = [];
    answering(seen);
    expect((await mcpSaleClient.getSale("g1")).buyer).toBe("Kisumu Grain Traders");
    expect(seen[0]).toEqual(["market_get_group_order", { groupOrderID: "g1" }]);
  });

  it("still reads the order when the shops cannot be listed", async () => {
    answering([], new Error("down"));
    expect((await mcpSaleClient.getSale("g1")).buyer).toBe("");
  });

  it("joins with a quantity and reads the order back", async () => {
    const seen: [string, any][] = [];
    answering(seen);
    await mcpSaleClient.join("g1", 5);
    expect(seen[0]).toEqual(["market_join_group_order", { groupOrderID: "g1", quantity: 5 }]);
    expect(seen.some(([name]) => name === "market_get_group_order")).toBe(true);
  });

  it("gives the collection date and note only to a member with a line", async () => {
    const own = sale({ date: "2026-11-09", note: "Bring sacks" });
    expect(await mcpSaleClient.collection!(own, "amina")).toEqual({ date: "2026-11-09", note: "Bring sacks" });
    expect(await mcpSaleClient.collection!(own, "otieno")).toEqual({ date: "", note: "" });
    expect(await mcpSaleClient.collection!(sale(), "amina")).toEqual({ date: "", note: "" });
  });
});

describe("the asks a seller answers", () => {
  const ask = (over: Partial<BuyerAsk> = {}): BuyerAsk => ({ id: "a1", posterId: "p1", offerId: "o1", asker: "Amina", question: "40 bags of urea", answer: "waiting", detail: "", ...over });

  const urea: supply.SupplyOffer = { id: "o1", supplierId: "p1", product: "Urea 50kg", words: "", unit: "bag", price: 4100, bulkFrom: 50, bulkPrice: 3900 } as any;
  const seed: supply.SupplyOffer = { id: "o2", supplierId: "p1", product: "Maize seed", words: "", unit: "bag", price: 2000, bulkFrom: 0, bulkPrice: 0 } as any;

  it("reads a row, naming the asker by the picker's name before the picker's id", () => {
    expect(buyerAskOf({ id: "a1", poster_id: "p1", offer_id: "o1", picker_name: "Amina", picker: "u1", question: "40 bags", answer: "yes" })).toEqual({
      id: "a1",
      posterId: "p1",
      offerId: "o1",
      asker: "Amina",
      question: "40 bags",
      answer: "yes",
      detail: "",
    });
    expect(buyerAskOf({ picker: "u1" }).asker).toBe("u1");
  });

  it("splits asks into the ones waiting and the ones answered", () => {
    const asks = [ask({ id: "a1", answer: "waiting" }), ask({ id: "a2", answer: "" }), ask({ id: "a3", answer: "yes" }), ask({ id: "a4", answer: "no" })];
    expect(waitingAsks(asks).map((one) => one.id)).toEqual(["a1", "a2"]);
    expect(answeredAsks(asks).map((one) => one.id)).toEqual(["a3", "a4"]);
  });

  it("prices an ask at the bulk price from the bulk quantity", () => {
    expect(askPrice(ask({ question: "40 bags of urea" }), [urea])).toEqual({ quantity: 40, unitWords: `${supply.kes(4100)} a bag`, totalWords: `${supply.kes(164000)} in all` });
    expect(askPrice(ask({ question: "50 bags of urea" }), [urea])).toEqual({ quantity: 50, unitWords: `${supply.kes(3900)} a bag`, totalWords: `${supply.kes(195000)} in all` });
  });

  it("finds the offer by the words in the question when the ask names no offer, from the same seller only", () => {
    expect(askPrice(ask({ offerId: "", question: "12 bags of maize seed" }), [urea, seed])?.unitWords).toBe(`${supply.kes(2000)} a bag`);
    expect(askPrice(ask({ offerId: "", question: "12 bags of maize seed" }), [{ ...seed, supplierId: "p2" } as any])).toBeNull();
  });

  it("gives no price when the question has no quantity or no offer matches", () => {
    expect(askPrice(ask({ question: "any urea left?" }), [urea])).toBeNull();
    expect(askPrice(ask({ offerId: "", question: "10 bags of sand" }), [urea])).toBeNull();
    expect(askPrice(ask(), [])).toBeNull();
  });

  it("lists only the asks to the seller's own shops", async () => {
    vi.spyOn(supply, "resolveMember").mockResolvedValue("m1");
    vi.spyOn(supply.mcpSupplyClient, "listSuppliers").mockResolvedValue([
      { id: "p1", shop: "Mine", owner: "m1" },
      { id: "p2", shop: "Theirs", owner: "m2" },
    ] as any);
    vi.spyOn(mcp, "callTool").mockResolvedValue({ items: [{ id: "a1", poster_id: "p1" }, { id: "a2", poster_id: "p2" }] });
    expect((await mcpBuyerAskClient.list("m1")).map((one) => one.id)).toEqual(["a1"]);
  });

  it("lists nothing for a member nobody knows", async () => {
    vi.spyOn(supply, "resolveMember").mockResolvedValue("");
    vi.spyOn(supply.mcpSupplyClient, "listSuppliers").mockResolvedValue([{ id: "p1", shop: "Mine", owner: "" }] as any);
    vi.spyOn(mcp, "callTool").mockResolvedValue({ items: [{ id: "a1", poster_id: "p1" }] });
    expect(await mcpBuyerAskClient.list("")).toEqual([]);
  });
});
