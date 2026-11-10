import * as mcp from "../../wakala/mcp";
import { kes } from "../../market/money";
import {
  bags,
  changedTermsWords,
  groupOrderOf,
  lastSeenOf,
  mcpJoinClient,
  myLineOf,
  orderOf,
  startedWithOf,
  termsWords,
  type OpenGroupOrder,
} from "./api";

afterEach(() => vi.restoreAllMocks());

const history = JSON.stringify([
  { version: 3, price: 3900, minimum: 15 },
  { version: 1, price: 4100, minimum: 20 },
  { version: 2, price: 4000, minimum: 20 },
]);

const answering = (tables: Record<string, unknown>, seen: [string, any][] = []) =>
  vi.spyOn(mcp, "callTool").mockImplementation(async (_hub: string, name: string, args: any) => {
    seen.push([name, args]);
    return tables[name] ?? {};
  });

describe("the terms a group order started with and last showed", () => {
  it("starts with the lowest version whatever order the history is stored in", () => {
    expect(startedWithOf(history)).toEqual({ price: 4100, minimum: 20 });
  });

  it("has no start when the history is empty, broken or not a list", () => {
    expect(startedWithOf("")).toBeNull();
    expect(startedWithOf("not json")).toBeNull();
    expect(startedWithOf('{"version":1}')).toBeNull();
    expect(startedWithOf(undefined)).toBeNull();
  });

  it("shows the terms the member last answered when they answered a version", () => {
    expect(lastSeenOf(history, 2, 3)).toEqual({ price: 4000, minimum: 20 });
  });

  it("shows the version before the current one when the member answered none", () => {
    expect(lastSeenOf(history, 0, 3)).toEqual({ price: 4000, minimum: 20 });
    expect(lastSeenOf(history, 0, 2)).toEqual({ price: 4100, minimum: 20 });
  });

  it("shows the newest terms when the current version is not known", () => {
    expect(lastSeenOf(history, 0, 0)).toEqual({ price: 3900, minimum: 15 });
  });

  it("falls back to the version before when the answered version is not in the history", () => {
    expect(lastSeenOf(history, 9, 3)).toEqual({ price: 4000, minimum: 20 });
  });

  it("has nothing to show when no version came before", () => {
    expect(lastSeenOf(history, 0, 1)).toBeNull();
  });
});

describe("words for terms", () => {
  it("counts a single bag as a bag", () => {
    expect(bags(1)).toBe("1 bag");
    expect(bags(20)).toBe("20 bags");
  });

  it("words the price and the minimum", () => {
    expect(termsWords({ price: 4100, minimum: 1 })).toBe(`${kes(4100)} a bag from 1 bag`);
    expect(termsWords({ price: 4100, minimum: 20 })).toBe(`${kes(4100)} a bag from 20 bags`);
  });

  it("names what changed since the order started, and nothing when it did not", () => {
    const started = { price: 4100, minimum: 20 };
    expect(changedTermsWords({ price: 3900, minimum: 20 }, started)).toBe("bulk price");
    expect(changedTermsWords({ price: 4100, minimum: 15 }, started)).toBe("minimum");
    expect(changedTermsWords({ price: 3900, minimum: 15 }, started)).toBe("bulk price and minimum");
    expect(changedTermsWords(started, started)).toBe("");
    expect(changedTermsWords({ price: 3900, minimum: 15 }, null)).toBe("");
  });
});

describe("a member's line in a group order", () => {
  const lines = [
    { id: "l1", picker: "amina", quantity: 5, answer: "yes", created_at: "2026-11-05T08:00:00Z", answered_version: 2 },
    { id: "l2", picker: "otieno", quantity: "7" },
  ];

  it("finds the line by the member and reads its numbers", () => {
    expect(myLineOf(lines, "amina")).toEqual({ id: "l1", quantity: 5, answer: "yes", joinedAt: "2026-11-05T08:00:00Z", answeredVersion: 2 });
    expect(myLineOf(lines, "otieno")).toEqual({ id: "l2", quantity: 7, answer: "", joinedAt: "", answeredVersion: 0 });
  });

  it("finds nothing for nobody, an unknown member or a hub that sent no lines", () => {
    expect(myLineOf(lines, "")).toBeNull();
    expect(myLineOf(lines, "wanjiru")).toBeNull();
    expect(myLineOf(undefined, "amina")).toBeNull();
  });

  it("reads the group order with the member's line and the terms they last saw", () => {
    const read = groupOrderOf(
      { id: "g1", poster_id: "p1", product: "urea", price: 3900, minimum: 15, state: "open", total: 12, count: 3, terms_history: history, terms_version: 3, promised_date: "2026-11-09", note: "Pick up", lines },
      "amina",
    );
    expect(read).toMatchObject({
      id: "g1",
      posterId: "p1",
      product: "urea",
      price: 3900,
      minimum: 15,
      total: 12,
      count: 3,
      date: "2026-11-09",
      note: "Pick up",
      startedWith: { price: 4100, minimum: 20 },
      lastSeen: { price: 4000, minimum: 20 },
    });
    expect(read.mine?.quantity).toBe(5);
  });

  it("reads an empty row as an order with zeros and no line", () => {
    expect(groupOrderOf(undefined, "amina")).toMatchObject({ id: "", price: 0, count: 0, startedWith: null, lastSeen: null, mine: null });
  });

  it("reads a bought order", () => {
    expect(orderOf({ id: "or1", poster_id: "p1", product: "urea", quantity: "5", unit_price: 4100, state: "placed", promised_date: "2026-11-09" })).toEqual({
      id: "or1",
      posterId: "p1",
      product: "urea",
      quantity: 5,
      unitPrice: 4100,
      state: "placed",
      promisedDate: "2026-11-09",
    });
  });
});

describe("the join client", () => {
  const closed: OpenGroupOrder = {
    id: "g1",
    posterId: "p1",
    product: "Urea",
    price: 4100,
    minimum: 20,
    state: "closed",
    total: 25,
    count: 3,
    startedWith: null,
    lastSeen: null,
    date: "",
    note: "",
    mine: { id: "l1", quantity: 5, answer: "", joinedAt: "2026-11-05T08:00:00Z", answeredVersion: 0 },
  };

  const mine = { id: "or1", picker: "amina", poster_id: "p1", product: "urea 50kg", quantity: 5, state: "placed", created_at: "2026-11-06T08:00:00Z" };

  it("asks the hub for the group order by its id", async () => {
    const seen: [string, any][] = [];
    answering({ market_get_group_order: { id: "g1", poster_id: "p1" } }, seen);
    expect((await mcpJoinClient.getGroupOrder("g1", "amina")).posterId).toBe("p1");
    expect(seen).toEqual([["market_get_group_order", { groupOrderID: "g1" }]]);
  });

  it("sends the quantity to join and the answer to a revision", async () => {
    const seen: [string, any][] = [];
    answering({}, seen);
    await mcpJoinClient.join("g1", 5);
    await mcpJoinClient.answerRevision("g1", "no");
    expect(seen).toEqual([
      ["market_join_group_order", { groupOrderID: "g1", quantity: 5 }],
      ["market_answer_revision", { groupOrderID: "g1", answer: "no" }],
    ]);
  });

  it("names the shop from its poster, and says nothing for a poster it does not know", async () => {
    answering({ market_list_posters: { items: [{ id: "p1", name: "Kisumu Agro Supplies" }] } });
    expect(await mcpJoinClient.shopName("p1")).toBe("Kisumu Agro Supplies");
    expect(await mcpJoinClient.shopName("p9")).toBe("");
  });

  it("names the product from the offers of that shop only", async () => {
    answering({
      market_list_offers: {
        items: [
          { poster_id: "p1", product: "urea", product_words: "Urea 50kg", price: 4100 },
          { poster_id: "p2", product: "urea", product_words: "Urea 25kg", price: 2200 },
        ],
      },
    });
    expect(await mcpJoinClient.productNameAt("p1", "urea")).toBe("Urea 50kg");
  });

  it("finds a closed order's own order: the member's, same shop, same quantity, made after joining", async () => {
    answering({
      market_list_orders: {
        items: [
          { ...mine, id: "early", created_at: "2026-11-04T08:00:00Z" },
          { ...mine, id: "other-picker", picker: "otieno" },
          { ...mine, id: "other-shop", poster_id: "p2" },
          { ...mine, id: "cancelled", state: "cancelled" },
          { ...mine, id: "other-quantity", quantity: 6 },
          { ...mine, id: "other-product", product: "seed" },
          { ...mine, id: "later", created_at: "2026-11-07T08:00:00Z" },
          mine,
        ],
      },
    });
    expect(await mcpJoinClient.findMyOrder(closed, "amina")).toBe("or1");
  });

  it("looks for no order while the group order is open, the member has no line or is unknown, or the join time is unreadable", async () => {
    const seen: [string, any][] = [];
    answering({ market_list_orders: { items: [mine] } }, seen);
    expect(await mcpJoinClient.findMyOrder({ ...closed, state: "open" }, "amina")).toBe("");
    expect(await mcpJoinClient.findMyOrder({ ...closed, mine: null }, "amina")).toBe("");
    expect(await mcpJoinClient.findMyOrder(closed, "")).toBe("");
    expect(await mcpJoinClient.findMyOrder({ ...closed, mine: { ...closed.mine!, joinedAt: "soon" } }, "amina")).toBe("");
    expect(seen).toEqual([]);
  });

  it("reads one order by its id", async () => {
    const seen: [string, any][] = [];
    answering({ market_get_order: { id: "or1", quantity: 5 } }, seen);
    expect((await mcpJoinClient.getOrder("or1")).quantity).toBe(5);
    expect(seen).toEqual([["market_get_order", { orderID: "or1" }]]);
  });
});
