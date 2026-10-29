import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import * as mcp from "../../wakala/mcp";
import { canCancelOrder, lineOrderOf, mcpMyOrdersClient, orderOf, trailWords, type MyOrder, type MyOrdersClient } from "./api";
import { MyOrderPage } from "./MyOrderPage";
import { MyOrdersPage } from "./MyOrdersPage";
import { routes } from "../../routes";
import { forgetOpenAgency, openAgency } from "../../agency/open";

beforeEach(() => openAgency("farmers"));

afterEach(() => forgetOpenAgency());

const buy: MyOrder = {
  kind: "buy",
  id: "or1",
  supplierId: "p1",
  product: "Urea 50kg",
  quantity: 2,
  unitPrice: 3800,
  standing: "Cancelled",
  promisedDate: "2026-11-06",
  createdAt: "2026-11-02T08:00:00Z",
};
const group: MyOrder = {
  kind: "group",
  id: "g1",
  supplierId: "p1",
  product: "Urea 50kg",
  quantity: 2,
  unitPrice: 3700,
  standing: "Paid",
  promisedDate: "",
  createdAt: "2026-11-02T09:00:00Z",
};

const clientOf = (orders: MyOrder[]): MyOrdersClient => ({
  listOrders: vi.fn().mockResolvedValue(orders),
  getOrder: vi.fn().mockResolvedValue(buy),
  getGroupLine: vi.fn().mockResolvedValue(group),
  cancelOrder: vi.fn().mockResolvedValue({ ...buy, standing: "Cancelled" }),
  getTrail: vi.fn().mockResolvedValue([
    { id: "t1", actor: "m1", what: "placed", at: "2026-11-02T08:00:00Z" },
    { id: "t2", actor: "m9", what: "marked paid", at: "2026-11-06T08:00:00Z" },
  ]),
  supplierNames: vi.fn().mockResolvedValue({ p1: "Kisumu Agro Supplies" }),
});

const show = (entry: string | { pathname: string; state: unknown }, client: MyOrdersClient) =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/started" element={<p>Ongoing page</p>} />
        <Route path={routes.market.pattern} element={<p>Market</p>} />
        <Route path={routes.marketOrder.pattern} element={<p>Order card</p>} />
        <Route path="/my-orders" element={<MyOrdersPage client={client} me="m1" />} />
        <Route path="/my-orders/:orderId" element={<MyOrderPage client={client} me="m1" />} />
        <Route path="/my-orders/group/:groupOrderId" element={<MyOrderPage group client={client} me="m1" />} />
      </Routes>
    </MemoryRouter>,
  );

describe("her orders", () => {
  it("lists a group line and a Buy now with the price each was made at and its state", async () => {
    show("/my-orders", clientOf([group, buy]));
    expect(await screen.findByText("Group order · KES 3,700 each")).toBeInTheDocument();
    expect(screen.getByText("Buy now · KES 3,800 each")).toBeInTheDocument();
    expect(screen.getByText("Paid")).toBeInTheDocument();
    expect(screen.getByText("Cancelled")).toBeInTheDocument();
  });

  it("says so when she has no orders and when they could not be loaded", async () => {
    show("/my-orders", clientOf([]));
    expect(await screen.findByText("No orders yet")).toBeInTheDocument();
    const broken = clientOf([]);
    (broken.listOrders as any).mockRejectedValue(new Error("down"));
    show("/my-orders", broken);
    expect(await screen.findByRole("alert")).toHaveTextContent("Your orders could not be loaded.");
  });

  it("opens a Buy now with its supplier, total, date and dated trail", async () => {
    const client = clientOf([buy]);
    show("/my-orders", client);
    await userEvent.click(await screen.findByText("Buy now · KES 3,800 each"));
    expect(await screen.findByText("Kisumu Agro Supplies")).toBeInTheDocument();
    expect(client.getOrder).toHaveBeenCalledWith("or1");
    expect(screen.getByText("KES 7,600")).toBeInTheDocument();
    expect(screen.getByText("Friday, 6 Nov")).toBeInTheDocument();
    expect(screen.getByText("Fri 6 Nov")).toBeInTheDocument();
    expect(screen.getByText("You placed the order")).toBeInTheDocument();
    expect(screen.getByText("Mon 2 Nov")).toBeInTheDocument();
    expect(screen.getByText("The shop marked it paid")).toBeInTheDocument();
  });

  it("offers Cancel on an order still waiting, cancels at once and refreshes the trail", async () => {
    const waiting: MyOrder = { ...buy, standing: "Waiting", promisedDate: "" };
    const client = clientOf([waiting]);
    (client.getOrder as any).mockResolvedValue(waiting);
    show("/my-orders/or1", client);
    await userEvent.click(await screen.findByRole("button", { name: "Cancel" }));
    expect(client.cancelOrder).toHaveBeenCalledWith("or1");
    expect(await screen.findByText("Cancelled")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
    expect(client.getTrail).toHaveBeenCalledTimes(2);
  });

  it("keeps the order and says so when cancelling fails", async () => {
    const waiting: MyOrder = { ...buy, standing: "Yes" };
    const client = clientOf([waiting]);
    (client.getOrder as any).mockResolvedValue(waiting);
    (client.cancelOrder as any).mockRejectedValue(new Error("refused"));
    show("/my-orders/or1", client);
    await userEvent.click(await screen.findByRole("button", { name: "Cancel" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not cancel this order. Try again.");
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("offers no Cancel on a cancelled, paid or group order", async () => {
    show("/my-orders/or1", clientOf([buy]));
    await screen.findByText("Kisumu Agro Supplies");
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
  });

  it("links a Buy now to its order card", async () => {
    show("/my-orders/or1", clientOf([buy]));
    await userEvent.click(await screen.findByRole("button", { name: "Order card" }));
    expect(await screen.findByText("Order card")).toBeInTheDocument();
  });

  it("opens a group line with her share and no trail", async () => {
    const client = clientOf([group]);
    show("/my-orders/group/g1", client);
    expect(await screen.findByText("Your share")).toBeInTheDocument();
    expect(client.getGroupLine).toHaveBeenCalledWith("g1", "m1");
    expect(client.getTrail).not.toHaveBeenCalled();
    expect(screen.getByText("KES 3,700 each")).toBeInTheDocument();
    expect(screen.getByText("KES 7,400")).toBeInTheDocument();
    expect(screen.queryByText("Trail")).not.toBeInTheDocument();
  });

  it("still shows the order when the trail cannot be read", async () => {
    const client = clientOf([buy]);
    (client.getTrail as any).mockRejectedValue(new Error("refused"));
    show("/my-orders/or1", client);
    expect(await screen.findByText("Kisumu Agro Supplies")).toBeInTheDocument();
    expect(screen.queryByText("Trail")).not.toBeInTheDocument();
  });

  it("says when the order could not be loaded", async () => {
    const client = clientOf([buy]);
    (client.getOrder as any).mockRejectedValue(new Error("gone"));
    show("/my-orders/or1", client);
    expect(await screen.findByRole("alert")).toHaveTextContent("This order could not be loaded.");
  });
});

describe("the my-orders client", () => {
  const call = (replies: Record<string, unknown>) =>
    vi.spyOn(mcp, "callTool").mockImplementation(async (_hub, tool) => (replies[tool] ?? { items: [] }) as any);

  afterEach(() => vi.restoreAllMocks());

  it("lists only orders she placed, not the ones she receives as a shop owner", async () => {
    call({
      market_list_orders: {
        items: [
          { id: "mine", picker: "m1", poster_id: "p1", product: "Urea", quantity: 2, unit_price: 3800, state: "placed" },
          { id: "theirs", picker: "m2", poster_id: "p9", product: "Urea", quantity: 5, unit_price: 3800, state: "placed" },
        ],
      },
    });
    expect((await mcpMyOrdersClient.listOrders("m1")).map((o) => o.id)).toEqual(["mine"]);
  });

  it("lists only her own line of a group order, leaves out sales, and puts the newest first", async () => {
    call({
      market_list_orders: { items: [{ id: "or1", picker: "m1", quantity: 1, unit_price: 3800, created_at: "2026-11-01T00:00:00Z" }] },
      market_list_group_orders: {
        items: [
          {
            id: "g1",
            poster_id: "p1",
            product: "Urea",
            price: 3700,
            terms_version: 1,
            state: "open",
            direction: "buy",
            lines: [
              { picker: "m2", quantity: 9, answer: "yes", answered_version: 1 },
              { picker: "m1", quantity: 2, answer: "yes", answered_version: 1, created_at: "2026-11-02T00:00:00Z" },
            ],
          },
          { id: "g2", direction: "sell", lines: [{ picker: "m1", quantity: 4, answer: "yes" }] },
        ],
      },
    });
    const all = await mcpMyOrdersClient.listOrders("m1");
    expect(all.map((o) => [o.kind, o.id, o.quantity])).toEqual([["group", "g1", 2], ["buy", "or1", 1]]);
  });

  it("finds her line in a group order that sits on the second page of orders", async () => {
    const filler = Array.from({ length: 200 }, (_, n) => ({ id: `g${String(n).padStart(4, "0")}`, direction: "buy", state: "open", lines: [{ picker: "m2", quantity: 1 }] }));
    const late = { id: "g0200", poster_id: "p1", product: "Urea", price: 3700, terms_version: 1, state: "open", direction: "buy", lines: [{ picker: "m1", quantity: 2, answer: "yes", answered_version: 1 }] };
    const spy = vi.spyOn(mcp, "callTool").mockImplementation((async (_hub: string, tool: string, args: Record<string, unknown>) => {
      if (tool !== "market_list_group_orders") return { items: [] };
      return args.after ? { items: [late] } : { items: filler };
    }) as any);
    expect((await mcpMyOrdersClient.listOrders("m1")).map((o) => [o.kind, o.id])).toEqual([["group", "g0200"]]);
    expect(spy.mock.calls.filter((args) => args[1] === "market_list_group_orders").map((args) => args[2])).toEqual([
      { limit: 200, mine: true },
      { limit: 200, mine: true, after: "g0199" },
    ]);
  });

  it("prices a group line at the terms she answered, not the terms now", () => {
    const history = JSON.stringify([{ version: 1, price: 3600, minimum: 20 }]);
    const group = { id: "g1", price: 3700, terms_version: 2, terms_history: history, state: "revising" };
    expect(lineOrderOf(group, { quantity: 2, answered_version: 1, answer: "yes" }).unitPrice).toBe(3600);
    expect(lineOrderOf(group, { quantity: 2, answered_version: 2, answer: "yes" }).unitPrice).toBe(3700);
  });

  it("names a line's state from what she answered and whether she was marked paid", () => {
    const g = { price: 1, terms_version: 1, state: "open" };
    expect(lineOrderOf(g, { answer: "waiting" }).standing).toBe("Waiting");
    expect(lineOrderOf(g, { answer: "yes" }).standing).toBe("Said yes");
    expect(lineOrderOf(g, { answer: "no" }).standing).toBe("Said no");
    expect(lineOrderOf(g, { answer: "yes", paid: true }).standing).toBe("Paid");
    expect(lineOrderOf({ ...g, state: "cancelled" }, { answer: "yes", paid: true }).standing).toBe("Cancelled");
  });

  it("names a Buy now's state", () => {
    expect(orderOf({ state: "placed" }).standing).toBe("Waiting");
    expect(orderOf({ state: "placed", promised_date: "2026-11-06" }).standing).toBe("Yes");
    expect(orderOf({ state: "placed", paid: true }).standing).toBe("Paid");
    expect(orderOf({ state: "cancelled", paid: true }).standing).toBe("Cancelled");
    expect(orderOf({ state: "delivered" }).standing).toBe("Delivered");
  });

  it("calls the market tools by the argument names the market declares", async () => {
    const spy = call({ market_get_group_order: { id: "g1", lines: [{ picker: "m1" }] } });
    await mcpMyOrdersClient.getOrder("or1");
    await mcpMyOrdersClient.getTrail("or1");
    await mcpMyOrdersClient.getGroupLine("g1", "m1");
    await mcpMyOrdersClient.supplierNames();
    expect(spy.mock.calls.map((c) => [c[1], c[2]])).toEqual([
      ["market_get_order", { orderID: "or1" }],
      ["market_order_trail", { orderID: "or1" }],
      ["market_get_group_order", { groupOrderID: "g1" }],
      ["market_list_offers", {}],
      ["market_list_posters", {}],
    ]);
  });

  it("takes the product in the shop's words from the offer, else keeps the slug", async () => {
    call({
      market_list_orders: { items: [{ id: "or1", picker: "m1", offer_id: "o1", product: "urea" }, { id: "or2", picker: "m1", offer_id: "gone", product: "maize" }] },
      market_list_group_orders: { items: [] },
      market_list_offers: { items: [{ id: "o1", product_words: "Urea 50kg" }] },
    });
    const all = await mcpMyOrdersClient.listOrders("m1");
    expect(all.map((o) => o.product).sort()).toEqual(["Urea 50kg", "maize"]);
  });

  it("names a group line with the words of that shop's cheapest offer for the group's product, else the key as sent", async () => {
    const offers = {
      items: [
        { id: "o1", poster_id: "p1", product: "urea", product_words: "Urea 50kg", price: 3800 },
        { id: "o2", poster_id: "p2", product: "urea", product_words: "Cheap urea", price: 3000 },
      ],
    };
    const group = {
      id: "g1",
      poster_id: "p1",
      product: "urea",
      price: 3700,
      terms_version: 1,
      state: "open",
      direction: "buy",
      lines: [{ picker: "m1", quantity: 2, answer: "yes", answered_version: 1 }],
    };
    call({ market_list_group_orders: { items: [group] }, market_get_group_order: group, market_list_offers: offers });
    expect((await mcpMyOrdersClient.listOrders("m1")).map((o) => o.product)).toEqual(["Urea 50kg"]);
    expect((await mcpMyOrdersClient.getGroupLine("g1", "m1")).product).toBe("Urea 50kg");
    vi.restoreAllMocks();
    call({ market_list_group_orders: { items: [{ ...group, poster_id: "p9" }] } });
    expect((await mcpMyOrdersClient.listOrders("m1")).map((o) => o.product)).toEqual(["urea"]);
  });

  it("keeps the group's key as sent when the offers cannot be read", async () => {
    const group = { id: "g1", poster_id: "p1", product: "urea", price: 3700, terms_version: 1, state: "open", lines: [{ picker: "m1", quantity: 2, answer: "yes" }] };
    vi.spyOn(mcp, "callTool").mockImplementation(async (_hub, tool) => {
      if (tool === "market_list_offers") throw new Error("down");
      return (tool === "market_list_group_orders" ? { items: [group] } : { items: [] }) as any;
    });
    expect((await mcpMyOrdersClient.listOrders("m1")).map((o) => o.product)).toEqual(["urea"]);
  });

  it("cancels with the declared order argument", async () => {
    const spy = call({ market_cancel_order: { id: "or1", state: "cancelled" }, market_list_offers: { items: [] } });
    expect((await mcpMyOrdersClient.cancelOrder("or1")).standing).toBe("Cancelled");
    expect(spy.mock.calls[0].slice(1)).toEqual(["market_cancel_order", { orderID: "or1" }]);
  });

  it("allows Cancel on a Waiting or Yes Buy now only", () => {
    expect(canCancelOrder({ ...buy, standing: "Waiting" })).toBe(true);
    expect(canCancelOrder({ ...buy, standing: "Yes" })).toBe(true);
    expect(canCancelOrder({ ...buy, standing: "Paid" })).toBe(false);
    expect(canCancelOrder({ ...buy, standing: "Cancelled" })).toBe(false);
    expect(canCancelOrder({ ...buy, standing: "Delivered" })).toBe(false);
    expect(canCancelOrder({ ...group, standing: "Waiting" })).toBe(false);
  });

  it("refuses a group order she has no line in", async () => {
    call({ market_get_group_order: { id: "g1", lines: [{ picker: "m2" }] } });
    await expect(mcpMyOrdersClient.getGroupLine("g1", "m1")).rejects.toThrow();
  });

  it("words the trail from her side", () => {
    expect(trailWords({ id: "1", actor: "m1", what: "cancelled", at: "" }, "m1")).toBe("You cancelled the order");
    expect(trailWords({ id: "1", actor: "m9", what: "delivered", at: "" }, "m1")).toBe("delivered");
  });
});

describe("where the back link of her order goes", () => {
  const back = () => userEvent.click(screen.getByRole("button", { name: "Back" }));

  it("goes back to the page she came from when a Buy now was opened with it", async () => {
    show({ pathname: "/my-orders/or1", state: { backTo: "/started" } }, clientOf([buy]));
    await screen.findByText("Kisumu Agro Supplies");
    await back();
    expect(await screen.findByText("Ongoing page")).toBeInTheDocument();
  });

  it("goes back to the page she came from when a group line was opened with it", async () => {
    show({ pathname: "/my-orders/group/g1", state: { backTo: "/started" } }, clientOf([group]));
    await screen.findByText("Your share");
    await back();
    expect(await screen.findByText("Ongoing page")).toBeInTheDocument();
  });

  it("goes back to the page she came from when the order could not be loaded", async () => {
    const client = clientOf([buy]);
    (client.getOrder as any).mockRejectedValue(new Error("gone"));
    show({ pathname: "/my-orders/or1", state: { backTo: "/started" } }, client);
    expect(await screen.findByRole("alert")).toHaveTextContent("This order could not be loaded.");
    await back();
    expect(await screen.findByText("Ongoing page")).toBeInTheDocument();
  });

  it("goes to My orders when it was opened with no state, as from a deep link", async () => {
    show("/my-orders/or1", clientOf([buy]));
    await screen.findByText("Kisumu Agro Supplies");
    await back();
    expect(await screen.findByText("Buy now · KES 3,800 each")).toBeInTheDocument();
    expect(screen.queryByText("Ongoing page")).not.toBeInTheDocument();
  });

  it.each([["https://x"], ["//x.test/started"], ["started"], [42]])("ignores a back target of %s and goes to My orders", async (target) => {
    show({ pathname: "/my-orders/or1", state: { backTo: target } }, clientOf([buy]));
    await screen.findByText("Kisumu Agro Supplies");
    await back();
    expect(await screen.findByText("Buy now · KES 3,800 each")).toBeInTheDocument();
  });
});
