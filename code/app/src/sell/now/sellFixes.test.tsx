import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import * as mcp from "../../wakala/mcp";
import { type BuyerPrice, type Sale, type SellClient } from "./api";
import { cancelSaleTool, canCancelSale, mcpSaleActions, withdrawSaleTool, type SaleActions } from "./cancel";
import { mcpOpenSales, type OpenSalesClient } from "./openSales";
import { SalePage } from "./SalePage";
import { SellPage } from "./SellPage";

const kisumu: BuyerPrice = {
  id: "o1",
  buyerId: "b1",
  buyer: "Kisumu Grain Traders",
  product: "maize",
  words: "Dry maize 90kg",
  unit: "bag",
  price: 4200,
  bulkPrice: 0,
  bulkFrom: 0,
};

const waiting: Sale = {
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
};
const said: Sale = { ...waiting, answer: "yes", yesId: "y1", orderId: "or1", state: "placed", promisedDate: "2026-11-06" };
const cancelled: Sale = { ...said, state: "cancelled" };

const sellClient = (sale: Sale): SellClient => ({
  listProducts: vi.fn().mockResolvedValue([]),
  listPrices: vi.fn().mockResolvedValue([kisumu]),
  listGroupSales: vi.fn().mockResolvedValue([]),
  sellNow: vi.fn(),
  getSale: vi.fn().mockResolvedValue(sale),
  bookSale: vi.fn().mockResolvedValue(undefined),
});

const showSale = (client: SellClient, actions: SaleActions) =>
  render(
    <MemoryRouter initialEntries={["/sell/sale/a1"]}>
      <Routes>
        <Route path="/sell/sale/:saleId" element={<SalePage client={client} actions={actions} />} />
      </Routes>
    </MemoryRouter>,
  );

const showMaize = (sales: OpenSalesClient) =>
  render(
    <MemoryRouter initialEntries={["/sell/maize"]}>
      <Routes>
        <Route path="/sell/:productId" element={<SellPage client={sellClient(waiting)} sales={sales} />} />
        <Route path="/sell/sale/:saleId" element={<p>Her sale</p>} />
      </Routes>
    </MemoryRouter>,
  );

describe("cancelling her sale", () => {
  it("offers Cancel the sale while the buyer has not answered and cancels it", async () => {
    const actions = { cancelSale: vi.fn().mockResolvedValue({ ...waiting, state: "cancelled" }) };
    showSale(sellClient(waiting), actions);
    await userEvent.click(await screen.findByRole("button", { name: "Cancel the sale" }));
    expect(actions.cancelSale).toHaveBeenCalledWith(waiting);
    expect(await screen.findByText("You cancelled the sale to Kisumu Grain Traders.")).toBeInTheDocument();
    expect(screen.getByText("Cancelled")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel the sale" })).toBeNull();
  });

  it("offers Cancel the sale after his yes too", async () => {
    showSale(sellClient(said), { cancelSale: vi.fn().mockResolvedValue(cancelled) });
    expect(await screen.findByRole("button", { name: "Cancel the sale" })).toBeInTheDocument();
  });

  it("offers nothing on a sale that is already cancelled", async () => {
    showSale(sellClient(cancelled), { cancelSale: vi.fn() });
    expect(await screen.findByText("Cancelled")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel the sale" })).toBeNull();
  });

  it("keeps the sale and says so when the cancel fails", async () => {
    showSale(sellClient(waiting), { cancelSale: vi.fn().mockRejectedValue(new Error("conflict")) });
    await userEvent.click(await screen.findByRole("button", { name: "Cancel the sale" }));
    expect(await screen.findByText("Could not cancel the sale. Try again.")).toBeInTheDocument();
    expect(screen.getByText("Waiting")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel the sale" })).toBeEnabled();
  });

  it("allows cancelling only a waiting or yes sale", () => {
    expect(canCancelSale(waiting)).toBe(true);
    expect(canCancelSale(said)).toBe(true);
    expect(canCancelSale(cancelled)).toBe(false);
  });

  it("cancels an order through market_cancel_order and a waiting ask through market_withdraw_ask", async () => {
    const calls: Array<[string, unknown]> = [];
    vi.spyOn(mcp, "callTool").mockImplementation((async (_hub: string, tool: string, args: unknown) => {
      calls.push([tool, args]);
      if (tool === "market_list_posters") return { items: [{ id: "b1", name: "Kisumu Grain Traders" }] };
      if (tool === "market_list_asks")
        return { items: [{ id: "a1", poster_id: "b1", offer_id: "o1", kind: "sale", product: "maize", question: "40 bags of maize", answer: "withdrawn" }] };
      return { items: [] };
    }) as any);
    const sale = await mcpSaleActions.cancelSale(waiting);
    expect(withdrawSaleTool).toBe("market_withdraw_ask");
    expect(calls).toContainEqual(["market_withdraw_ask", { askID: "a1" }]);
    expect(sale).toMatchObject({ id: "a1", buyer: "Kisumu Grain Traders", state: "cancelled" });
    await mcpSaleActions.cancelSale(said);
    expect(cancelSaleTool).toBe("market_cancel_order");
    expect(calls).toContainEqual(["market_cancel_order", { orderID: "or1" }]);
    vi.restoreAllMocks();
  });
});

describe("her open sales on the maize page", () => {
  it("lists each open sale with a link to its page", async () => {
    showMaize({ listOpenSales: vi.fn().mockResolvedValue([waiting]) });
    expect(await screen.findByText("Your sales")).toBeInTheDocument();
    expect(screen.getByText("Kisumu Grain Traders · Waiting")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /40 bags of Dry maize 90kg/ }));
    expect(await screen.findByText("Her sale")).toBeInTheDocument();
  });

  it("shows nothing when she has no open sale", async () => {
    showMaize({ listOpenSales: vi.fn().mockResolvedValue([]) });
    expect(await screen.findByText("Kisumu Grain Traders")).toBeInTheDocument();
    expect(screen.queryByText("Your sales")).toBeNull();
  });

  it("still shows the prices when her sales could not be loaded", async () => {
    showMaize({ listOpenSales: vi.fn().mockRejectedValue(new Error("down")) });
    expect(await screen.findByText("Kisumu Grain Traders")).toBeInTheDocument();
    expect(screen.queryByText("Your sales")).toBeNull();
  });

  it("reads only her maize sale asks that are not cancelled", async () => {
    vi.spyOn(mcp, "callTool").mockImplementation((async (_hub: string, tool: string) => {
      if (tool === "market_list_posters") return { items: [{ id: "b1", name: "Kisumu Grain Traders" }] };
      if (tool === "market_list_asks")
        return {
          items: [
            { id: "a1", poster_id: "b1", kind: "sale", product: "maize", question: "40 bags of maize", answer: "waiting" },
            { id: "a2", poster_id: "b1", kind: "sale", product: "maize", question: "5 bags of maize", answer: "withdrawn" },
            { id: "a3", poster_id: "b1", kind: "sale", product: "beans", question: "3 bags of beans", answer: "waiting" },
            { id: "a4", poster_id: "b1", kind: "errand", product: "", question: "Can you take me", answer: "waiting" },
          ],
        };
      return { items: [] };
    }) as any);
    const sales = await mcpOpenSales.listOpenSales("maize");
    expect(sales.map((sale) => sale.id)).toEqual(["a1"]);
    expect(sales[0]).toMatchObject({ buyer: "Kisumu Grain Traders", quantity: 40 });
    vi.restoreAllMocks();
  });
});
