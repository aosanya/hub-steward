import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import * as mcp from "../../wakala/mcp";
import { BoughtOrderPage } from "../join/BoughtOrderPage";
import type { BoughtOrder, JoinClient } from "../join/api";
import { lineOrderOf, mcpMyOrdersClient, trailDay, trailWords, type MyOrder, type MyOrdersClient } from "./api";
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
  standing: "Paid",
  promisedDate: "2026-11-06",
  createdAt: "2026-11-02T08:00:00Z",
};
const group: MyOrder = { ...buy, kind: "group", id: "g1", unitPrice: 3700, standing: "Confirmed", promisedDate: "" };

const clientOf = (order: MyOrder): MyOrdersClient => ({
  listOrders: vi.fn().mockResolvedValue([group, buy]),
  getOrder: vi.fn().mockResolvedValue(order),
  getGroupLine: vi.fn().mockResolvedValue(group),
  cancelOrder: vi.fn(),
  getTrail: vi.fn().mockResolvedValue([
    { id: "t1", actor: "m1", what: "placed", at: "2026-11-02T08:00:00Z" },
    { id: "t2", actor: "m1", what: "cancelled", at: "2026-11-04T08:00:00Z" },
    { id: "t3", actor: "m9", what: "marked paid", at: "2026-11-06T08:00:00Z" },
  ]),
  supplierNames: vi.fn().mockResolvedValue({ p1: "Kisumu Agro Supplies" }),
});

const bought: BoughtOrder = { id: "or1", posterId: "p1", product: "Urea 50kg", quantity: 2, unitPrice: 3700, state: "placed", promisedDate: "2026-11-06" };
const joinClient = (order: BoughtOrder = bought): JoinClient => ({
  getGroupOrder: vi.fn(),
  shopName: vi.fn().mockResolvedValue("Kisumu Agro Supplies"),
  productNameAt: vi.fn().mockResolvedValue("Urea 50kg"),
  join: vi.fn(),
  answerRevision: vi.fn(),
  findMyOrder: vi.fn(),
  getOrder: vi.fn().mockResolvedValue(order),
});

const showOrder = (entry: string, client: MyOrdersClient) =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/my-orders" element={<MyOrdersPage client={client} me="m1" />} />
        <Route path="/my-orders/:orderId" element={<MyOrderPage client={client} me="m1" />} />
        <Route path="/my-orders/group/:groupOrderId" element={<MyOrderPage group client={client} me="m1" />} />
      </Routes>
    </MemoryRouter>,
  );

const showBought = (client: JoinClient, orders: Pick<MyOrdersClient, "getOrder" | "getTrail">) =>
  render(
    <MemoryRouter initialEntries={["/a/farmers/market/bought/or1"]}>
      <Routes>
        <Route path={routes.boughtOrder.pattern} element={<BoughtOrderPage client={client} orders={orders} me="m1" />} />
      </Routes>
    </MemoryRouter>,
  );

describe("one order and its trail", () => {
  it("lists the trail as given, each line in plain words with a short day", async () => {
    showOrder("/my-orders/or1", clientOf(buy));
    expect(await screen.findByText("Trail")).toBeInTheDocument();
    const titles = screen.getAllByText(/placed the order|cancelled the order|marked it paid/).map((el) => el.textContent);
    expect(titles).toEqual(["You placed the order", "You cancelled the order", "The shop marked it paid"]);
    expect(screen.getByText("Mon 2 Nov")).toBeInTheDocument();
    expect(screen.getByText("Wed 4 Nov")).toBeInTheDocument();
    expect(screen.getByText("Fri 6 Nov")).toBeInTheDocument();
  });

  it("names the kind and the product as the sub line under the title, once, and nothing else in the head", async () => {
    showOrder("/my-orders/or1", clientOf(buy));
    const sub = await screen.findByText("Buy now · Urea 50kg");
    expect(screen.getAllByText("Buy now · Urea 50kg")).toHaveLength(1);
    expect(sub).toHaveClass("sub");
    const title = screen.getByRole("heading", { level: 1, name: "2 of Urea 50kg" });
    expect(title.parentElement).toBe(sub.parentElement);
    expect(title.parentElement?.nextElementSibling).toBe(screen.getByText("Status").closest(".rows"));
  });

  it("asks the market for the trail by order and words an unlisted action plainly", async () => {
    const spy = vi.spyOn(mcp, "callTool").mockResolvedValue({ items: [{ id: "t", actor: "m9", what: "delivered", at: "2026-11-07T08:00:00Z" }] } as any);
    const trail = await mcpMyOrdersClient.getTrail("or1");
    expect(spy.mock.calls[0].slice(1)).toEqual(["market_order_trail", { orderID: "or1" }]);
    expect(trailWords(trail[0], "m1")).toBe("delivered");
    expect(trailDay(trail[0])).toBe("Sat 7 Nov");
    spy.mockRestore();
  });

  it("sorts what the market sends oldest first", async () => {
    const spy = vi.spyOn(mcp, "callTool").mockResolvedValue({
      items: [
        { id: "t3", actor: "m9", what: "marked paid", at: "2026-11-06T08:00:00Z" },
        { id: "t1", actor: "m1", what: "placed", at: "2026-11-02T08:00:00Z" },
      ],
    } as any);
    expect((await mcpMyOrdersClient.getTrail("or1")).map((line) => line.id)).toEqual(["t1", "t3"]);
    spy.mockRestore();
  });

  it("names the day the event happened locally, not the UTC day", () => {
    const at = new Date(2026, 10, 7, 1, 30).toISOString();
    expect(trailDay({ id: "1", actor: "", what: "placed", at })).toBe("Sat 7 Nov");
  });

  it("keeps an unreadable day as it came", () => {
    expect(trailDay({ id: "1", actor: "", what: "placed", at: "" })).toBe("");
    expect(trailDay({ id: "1", actor: "", what: "placed", at: "soon" })).toBe("soon");
  });
});

describe("a group order on My orders", () => {
  it("shows what the page knows and no trail, and never asks for one", async () => {
    const client = clientOf(buy);
    showOrder("/my-orders/group/g1", client);
    expect(await screen.findByText("Group order · Urea 50kg")).toHaveClass("sub");
    expect(screen.getByText("Confirmed")).toBeInTheDocument();
    expect(screen.getByText("Your share")).toBeInTheDocument();
    expect(screen.getByText("KES 3,700 each")).toBeInTheDocument();
    expect(screen.getByText("KES 7,400")).toBeInTheDocument();
    expect(screen.queryByText("Trail")).not.toBeInTheDocument();
    expect(client.getTrail).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Order card" })).not.toBeInTheDocument();
  });

  it("calls her line Confirmed once the group order is sent, Paid when she was marked paid", () => {
    const closed = { price: 3700, terms_version: 1, state: "closed" };
    expect(lineOrderOf(closed, { answer: "yes" }).standing).toBe("Confirmed");
    expect(lineOrderOf(closed, { answer: "" }).standing).toBe("Confirmed");
    expect(lineOrderOf(closed, { answer: "yes", paid: true }).standing).toBe("Paid");
    expect(lineOrderOf(closed, { answer: "no" }).standing).toBe("Said no");
    expect(lineOrderOf({ ...closed, state: "revising" }, { answer: "yes" }).standing).toBe("Said yes");
  });

  it("lists the Confirmed group line beside the Buy now with the same words the detail uses", async () => {
    showOrder("/my-orders", clientOf(buy));
    expect(await screen.findByText("Confirmed")).toBeInTheDocument();
    expect(screen.getByText("Paid")).toBeInTheDocument();
  });
});

describe("the bought order a group order leads to", () => {
  it("says Yes when the shop gave a date, as My orders does", async () => {
    showBought(joinClient(), { getOrder: vi.fn().mockResolvedValue({ ...buy, standing: "Yes" }), getTrail: vi.fn().mockResolvedValue([]) });
    expect(await screen.findByText("Friday, 6 Nov")).toBeInTheDocument();
    expect(await screen.findByText("Yes")).toBeInTheDocument();
    expect(screen.queryByText("Placed")).not.toBeInTheDocument();
  });

  it("says Waiting before the shop gave a date, Cancelled after a cancel and Paid once marked paid", async () => {
    const orders = (standing: MyOrder["standing"]) => ({ getOrder: vi.fn().mockResolvedValue({ ...buy, standing }), getTrail: vi.fn().mockResolvedValue([]) });
    const waiting = showBought(joinClient({ ...bought, promisedDate: "" }), orders("Waiting"));
    expect(await screen.findByText("Waiting")).toBeInTheDocument();
    waiting.unmount();
    const cancelled = showBought(joinClient({ ...bought, state: "cancelled" }), orders("Cancelled"));
    expect(await screen.findByText("Cancelled")).toBeInTheDocument();
    cancelled.unmount();
    showBought(joinClient(), orders("Paid"));
    expect(await screen.findByText("Paid")).toBeInTheDocument();
  });

  it("shows the order's own trail from the market", async () => {
    const orders = clientOf(buy);
    showBought(joinClient(), orders);
    expect(await screen.findByText("Trail")).toBeInTheDocument();
    expect(orders.getTrail).toHaveBeenCalledWith("or1");
    expect(screen.getByText("You placed the order")).toBeInTheDocument();
    expect(screen.getByText("The shop marked it paid")).toBeInTheDocument();
  });

  it("still shows the order, with the words it can tell from the order, when the trail and the order card cannot be read", async () => {
    const broken = { getOrder: vi.fn().mockRejectedValue(new Error("down")), getTrail: vi.fn().mockRejectedValue(new Error("down")) };
    showBought(joinClient(), broken);
    expect(await screen.findByText("Your share")).toBeInTheDocument();
    expect(await screen.findByText("Yes")).toBeInTheDocument();
    expect(screen.queryByText("Trail")).not.toBeInTheDocument();
  });
});
