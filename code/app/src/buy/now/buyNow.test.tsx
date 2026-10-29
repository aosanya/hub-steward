import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import * as mcp from "../../wakala/mcp";
import { buyOrderOf, mcpBuyNowClient, orderTotal, type BuyNowClient, type BuyOffer, type BuyOrder } from "./api";
import { BuyNowPage } from "./BuyNowPage";
import { BuyOrderPage } from "./BuyOrderPage";
import { canCancel, orderStatus } from "./standing";
import { routes } from "../../routes";
import { forgetOpenAgency, openAgency } from "../../agency/open";

beforeEach(() => openAgency("farmers"));

afterEach(() => forgetOpenAgency());

const offer: BuyOffer = {
  id: "o1",
  posterId: "p1",
  shop: "Kisumu Agro Supplies",
  words: "Urea 50kg",
  product: "urea",
  unit: "bag",
  unitPrice: 3800,
};

const waiting: BuyOrder = {
  id: "or1",
  posterId: "p1",
  shop: "Kisumu Agro Supplies",
  product: "Urea 50kg",
  unit: "bag",
  quantity: 2,
  unitPrice: 3800,
  state: "placed",
  promisedDate: "",
  paid: false,
};
const said: BuyOrder = { ...waiting, promisedDate: "2026-11-06" };
const cancelled: BuyOrder = { ...waiting, state: "cancelled" };

const clientOf = (order: BuyOrder): BuyNowClient => ({
  getOffer: vi.fn().mockResolvedValue(offer),
  buyNow: vi.fn().mockResolvedValue(waiting),
  getOrder: vi.fn().mockResolvedValue(order),
  cancelOrder: vi.fn().mockResolvedValue(cancelled),
});

const show = (entry: string, client: BuyNowClient) =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path={routes.market.pattern} element={<p>Market</p>} />
        <Route path={routes.product.pattern} element={<p>Product</p>} />
        <Route path={routes.buyNow.pattern} element={<BuyNowPage client={client} />} />
        <Route path={routes.marketOrder.pattern} element={<BuyOrderPage client={client} />} />
      </Routes>
    </MemoryRouter>,
  );

describe("Buy now", () => {
  it("shows the offer, orders the bags and lands on the order asking the shop", async () => {
    const client = clientOf(waiting);
    show("/a/farmers/market/urea/buy/o1", client);
    expect(await screen.findByText("Urea 50kg · Kisumu Agro Supplies · KES 3,800 a bag")).toBeInTheDocument();
    const buy = screen.getByRole("button", { name: "Buy now" });
    expect(buy).toBeDisabled();
    await userEvent.type(screen.getByLabelText("How many bags"), "2");
    await userEvent.type(screen.getByLabelText("Needed by"), "2026-11-06");
    await userEvent.click(buy);
    expect(client.buyNow).toHaveBeenCalledWith("o1", 2, undefined);
    const title = await screen.findByRole("heading", { level: 1, name: "2 bags of Urea 50kg" });
    expect(screen.getByRole("banner")).not.toContainElement(title);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByText("Waiting")).toBeInTheDocument();
    expect(screen.getByText("Friday, 6 Nov")).toBeInTheDocument();
    expect(screen.getByText("Asking Kisumu Agro Supplies about 2 bags.")).toBeInTheDocument();
  });

  it("sends the yes it came from so the order carries the shop's date", async () => {
    const client = clientOf(waiting);
    show("/a/farmers/market/urea/buy/o1?yes=y1", client);
    await userEvent.type(await screen.findByLabelText("How many bags"), "2");
    await userEvent.click(screen.getByRole("button", { name: "Buy now" }));
    expect(client.buyNow).toHaveBeenCalledWith("o1", 2, "y1");
  });

  it("sends no yes when it did not come from one", async () => {
    const client = clientOf(waiting);
    show("/a/farmers/market/urea/buy/o1", client);
    await userEvent.type(await screen.findByLabelText("How many bags"), "2");
    await userEvent.click(screen.getByRole("button", { name: "Buy now" }));
    expect(client.buyNow).toHaveBeenCalledWith("o1", 2, undefined);
  });

  it("refuses zero bags and a half bag", async () => {
    show("/a/farmers/market/urea/buy/o1", clientOf(waiting));
    await screen.findByText("Urea 50kg · Kisumu Agro Supplies · KES 3,800 a bag");
    await userEvent.type(screen.getByLabelText("How many bags"), "0");
    expect(screen.getByRole("button", { name: "Buy now" })).toBeDisabled();
    await userEvent.clear(screen.getByLabelText("How many bags"));
    await userEvent.type(screen.getByLabelText("How many bags"), "1.5");
    expect(screen.getByRole("button", { name: "Buy now" })).toBeDisabled();
  });

  it("stays on the form and says so when the order is refused", async () => {
    const client = clientOf(waiting);
    (client.buyNow as any).mockRejectedValue(new Error("refused"));
    show("/a/farmers/market/urea/buy/o1", client);
    await userEvent.type(await screen.findByLabelText("How many bags"), "2");
    await userEvent.click(screen.getByRole("button", { name: "Buy now" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not place this order. Try again.");
    expect(screen.getByRole("button", { name: "Buy now" })).toBeEnabled();
  });

  it("says when the offer could not be loaded", async () => {
    const client = clientOf(waiting);
    (client.getOffer as any).mockRejectedValue(new Error("down"));
    show("/a/farmers/market/urea/buy/o1", client);
    expect(await screen.findByRole("alert")).toHaveTextContent("This offer could not be loaded.");
  });
});

describe("the order card", () => {
  it("shows the price it was made at and the total while the shop has not answered", async () => {
    show("/a/farmers/market/orders/or1", clientOf(waiting));
    expect(await screen.findByText("Waiting")).toBeInTheDocument();
    expect(screen.getByText("KES 3,800 a bag")).toBeInTheDocument();
    expect(screen.getByText("KES 7,600")).toBeInTheDocument();
    expect(screen.queryByText("Shop's date")).not.toBeInTheDocument();
  });

  it("shows the shop's yes with its date", async () => {
    show("/a/farmers/market/orders/or1", clientOf(said));
    expect(await screen.findByText("Yes")).toBeInTheDocument();
    expect(screen.getByText("Shop's date")).toBeInTheDocument();
    expect(screen.getByText("Friday, 6 Nov")).toBeInTheDocument();
    expect(screen.queryByText(/Asking/)).not.toBeInTheDocument();
  });

  it("shows Paid, not Delivered, on a paid delivered order and offers no Cancel", async () => {
    show("/a/farmers/market/orders/or1", clientOf({ ...said, state: "delivered", paid: true }));
    expect(await screen.findByText("Paid")).toBeInTheDocument();
    expect(screen.queryByText("Delivered")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
  });

  it("offers no Cancel on a paid order the shop said yes to", async () => {
    show("/a/farmers/market/orders/or1", clientOf({ ...said, paid: true }));
    expect(await screen.findByText("Paid")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
  });

  it("says when the order could not be loaded", async () => {
    const client = clientOf(waiting);
    (client.getOrder as any).mockRejectedValue(new Error("down"));
    show("/a/farmers/market/orders/or1", client);
    expect(await screen.findByRole("alert")).toHaveTextContent("This order could not be loaded.");
  });
});

describe("cancel an order", () => {
  it("cancels at once and tells the shop", async () => {
    const client = clientOf(waiting);
    show("/a/farmers/market/orders/or1", client);
    await userEvent.click(await screen.findByRole("button", { name: "Cancel" }));
    expect(client.cancelOrder).toHaveBeenCalledWith("or1");
    expect(await screen.findByText("Cancelled")).toBeInTheDocument();
    expect(screen.getByText("Telling Kisumu Agro Supplies that you cancelled.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
  });

  it("cancels after the shop said yes", async () => {
    const client = clientOf(said);
    show("/a/farmers/market/orders/or1", client);
    await userEvent.click(await screen.findByRole("button", { name: "Cancel" }));
    expect(await screen.findByText("Cancelled")).toBeInTheDocument();
  });

  it("offers no Cancel on an order already cancelled", async () => {
    show("/a/farmers/market/orders/or1", clientOf(cancelled));
    expect(await screen.findByText("Cancelled")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
  });

  it("keeps the order and says so when cancelling fails", async () => {
    const client = clientOf(waiting);
    (client.cancelOrder as any).mockRejectedValue(new Error("refused"));
    show("/a/farmers/market/orders/or1", client);
    await userEvent.click(await screen.findByRole("button", { name: "Cancel" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not cancel this order. Try again.");
    expect(screen.getByText("Waiting")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });
});

describe("the buy now client", () => {
  it("reads the tool result into an order and its status", () => {
    const order = buyOrderOf({ id: "or1", poster_id: "p1", product: "urea", quantity: 2, unit_price: 3800, state: "placed" }, "Kisumu Agro Supplies");
    expect(orderTotal(order)).toBe(7600);
    expect(orderStatus(order)).toBe("Waiting");
    expect(orderStatus({ ...order, promisedDate: "2026-11-06" })).toBe("Yes");
    expect(orderStatus({ ...order, state: "cancelled", promisedDate: "2026-11-06" })).toBe("Cancelled");
  });

  it("agrees with My orders: paid wins over delivered, cancelled wins over paid, paid cannot be cancelled", () => {
    const order = buyOrderOf({ id: "or1", state: "delivered", paid: true, promised_date: "2026-11-06" });
    expect(order.paid).toBe(true);
    expect(orderStatus(order)).toBe("Paid");
    expect(orderStatus({ ...order, state: "cancelled" })).toBe("Cancelled");
    expect(orderStatus({ ...order, state: "delivered", paid: false })).toBe("Delivered");
    expect(canCancel(order)).toBe(false);
    expect(canCancel({ ...order, state: "placed", paid: false })).toBe(true);
    expect(canCancel({ ...order, state: "placed", promisedDate: "", paid: false })).toBe(true);
    expect(canCancel({ ...order, state: "delivered", paid: false })).toBe(false);
  });

  it("calls the market tools by name and names the shop from the posters", async () => {
    const order = { id: "or1", poster_id: "p1", product: "urea", quantity: 2, unit_price: 3800, state: "placed" };
    const call = vi.spyOn(mcp, "callTool").mockImplementation(async (_hub: string, tool: string) => {
      if (tool === "market_list_posters") return { items: [{ id: "p1", name: "Kisumu Agro Supplies" }] } as any;
      if (tool === "market_list_offers") return { items: [{ id: "o1", poster_id: "p1", product_words: "Urea 50kg", unit_words: "bag", price: 3800 }] } as any;
      return order as any;
    });
    expect((await mcpBuyNowClient.getOffer("o1")).shop).toBe("Kisumu Agro Supplies");
    expect((await mcpBuyNowClient.buyNow("o1", 2)).shop).toBe("Kisumu Agro Supplies");
    await mcpBuyNowClient.buyNow("o1", 2, "y1");
    await mcpBuyNowClient.getOrder("or1");
    await mcpBuyNowClient.cancelOrder("or1");
    const calls = call.mock.calls.map((c) => [c[1], c[2]]).filter(([tool]) => tool !== "market_list_posters" && tool !== "market_list_offers");
    expect(calls).toEqual([
      ["market_buy_now", { offerID: "o1", quantity: 2 }],
      ["market_buy_now", { offerID: "o1", quantity: 2, yes_id: "y1" }],
      ["market_get_order", { orderID: "or1" }],
      ["market_cancel_order", { orderID: "or1" }],
    ]);
    call.mockRestore();
  });

  it("names the product in the shop's words from the offer the order came from, else keeps the slug", async () => {
    const order = { id: "or1", poster_id: "p1", offer_id: "o1", product: "urea", quantity: 2, unit_price: 3800, state: "placed" };
    const call = vi.spyOn(mcp, "callTool").mockImplementation(async (_hub: string, tool: string) => {
      if (tool === "market_list_posters") return { items: [{ id: "p1", name: "Kisumu Agro Supplies" }] } as any;
      if (tool === "market_list_offers") return { items: [{ id: "o1", poster_id: "p1", product_words: "Urea 50kg", unit_words: "bag", price: 3800 }] } as any;
      return order as any;
    });
    expect((await mcpBuyNowClient.getOrder("or1")).product).toBe("Urea 50kg");
    call.mockImplementation(async (_hub: string, tool: string) => {
      if (tool === "market_list_offers") throw new Error("down");
      return (tool === "market_list_posters" ? { items: [] } : order) as any;
    });
    expect((await mcpBuyNowClient.getOrder("or1")).product).toBe("urea");
    call.mockRestore();
  });

  it("fails to load an offer that is not listed", async () => {
    const call = vi.spyOn(mcp, "callTool").mockResolvedValue({ items: [] } as any);
    await expect(mcpBuyNowClient.getOffer("nope")).rejects.toThrow();
    call.mockRestore();
  });
});
