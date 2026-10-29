import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import * as mcp from "../../wakala/mcp";
import { mcpSellClient, type BuyerPrice, type GroupSale, type SellClient } from "./api";
import { SellPage } from "./SellPage";

const kisumu: BuyerPrice = {
  id: "o1",
  buyerId: "b1",
  buyer: "Kisumu Grain Traders",
  product: "maize",
  words: "Dry maize 90kg",
  unit: "bag",
  price: 4200,
  bulkPrice: 4350,
  bulkFrom: 100,
};
const siaya: BuyerPrice = {
  ...kisumu,
  id: "o2",
  buyerId: "b2",
  buyer: "Siaya Millers",
  words: "MAIZE grain (bag)",
  unit: "bag",
  price: 3900,
  bulkPrice: 0,
  bulkFrom: 0,
};
const groupSale: GroupSale = { id: "g1", buyerId: "b1", product: "maize", price: 4350, from: 100 };

const clientOf = (prices: BuyerPrice[], groupSales: GroupSale[] = []): SellClient => ({
  listProducts: vi.fn().mockResolvedValue([]),
  listPrices: vi.fn().mockResolvedValue(prices),
  listGroupSales: vi.fn().mockResolvedValue(groupSales),
  sellNow: vi.fn(),
  getSale: vi.fn(),
  bookSale: vi.fn(),
});

const showPage = (client: SellClient) =>
  render(
    <MemoryRouter initialEntries={["/sell/maize"]}>
      <Routes>
        <Route path="/sell" element={<p>The list of products</p>} />
        <Route path="/sell/:productId" element={<SellPage client={client} sales={{ listOpenSales: vi.fn().mockResolvedValue([]) }} />} />
        <Route path="/sell/:productId/now/:offerId" element={<p>The sell now form</p>} />
        <Route path="/sell/group/:orderId" element={<p>The group sale</p>} />
      </Routes>
    </MemoryRouter>,
  );

describe("the buyers' prices for maize", () => {
  it("shows each buyer's row in his own words with the price a bag and the bulk price", async () => {
    showPage(clientOf([kisumu, siaya]));
    expect(await screen.findByText("Kisumu Grain Traders")).toBeInTheDocument();
    expect(screen.getByText("Dry maize 90kg")).toBeInTheDocument();
    expect(screen.getAllByText("MAIZE grain (bag)")).toHaveLength(2);
    expect(screen.getByText("KES 4,200 a bag")).toBeInTheDocument();
    expect(screen.getByText("KES 3,900 a bag")).toBeInTheDocument();
    expect(screen.getByText("Bulk price KES 4,350 a bag from 100 bags")).toBeInTheDocument();
    expect(screen.getAllByText(/Bulk price/)).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Sell now" })).toHaveLength(2);
  });

  it("titles the page with the cheapest buyer's words for the product", async () => {
    showPage(clientOf([kisumu, siaya]));
    expect(await screen.findByRole("heading", { name: "MAIZE grain (bag)" })).toBeInTheDocument();
  });

  it("titles the page with the product as the data holds it when no buyer has words", async () => {
    showPage(clientOf([{ ...kisumu, words: "" }]));
    expect(await screen.findByRole("heading", { name: "maize" })).toBeInTheDocument();
  });

  it("goes back to the list of products", async () => {
    showPage(clientOf([kisumu]));
    await userEvent.click(await screen.findByRole("button", { name: "Back" }));
    expect(await screen.findByText("The list of products")).toBeInTheDocument();
  });

  it("offers Join only on the buyer whose group sale is open", async () => {
    showPage(clientOf([kisumu, siaya], [groupSale]));
    expect(await screen.findByText("Group sale open KES 4,350 a bag from 100 bags")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Join" })).toHaveLength(1);
    await userEvent.click(screen.getByRole("button", { name: "Join" }));
    expect(await screen.findByText("The group sale")).toBeInTheDocument();
  });

  it("needs no ask to see a posted price", async () => {
    showPage(clientOf([kisumu]));
    await screen.findByText("Kisumu Grain Traders");
    expect(screen.queryByRole("button", { name: /ask/i })).toBeNull();
  });

  it("opens the sell now form of the buyer picked", async () => {
    showPage(clientOf([kisumu]));
    await userEvent.click(await screen.findByRole("button", { name: "Sell now" }));
    expect(await screen.findByText("The sell now form")).toBeInTheDocument();
  });

  it("says so when no buyer has posted a price", async () => {
    showPage(clientOf([]));
    expect(await screen.findByText("No buyer has posted a price yet.")).toBeInTheDocument();
  });

  it("says when the prices could not be loaded", async () => {
    const client = clientOf([]);
    (client.listPrices as any).mockRejectedValue(new Error("down"));
    showPage(client);
    expect(await screen.findByText("The buyers' prices could not be loaded.")).toBeInTheDocument();
  });
});

describe("the sell client's reads", () => {
  const answer = (replies: Record<string, unknown>) =>
    vi.spyOn(mcp, "callTool").mockImplementation(async (_hub: string, tool: string) => (replies[tool] ?? { items: [] }) as any);

  it("lists the approved buyers' maize best price first, with their names", async () => {
    const spy = answer({
      market_list_posters: {
        items: [
          { id: "b1", name: "Kisumu Grain Traders", status: "approved" },
          { id: "b2", name: "Pending Millers", status: "pending" },
        ],
      },
      market_list_offers: {
        items: [
          { id: "o2", poster_id: "b1", product: "maize", product_words: "Maize B", price: 3900 },
          { id: "o1", poster_id: "b1", product: "maize", product_words: "Maize A", price: 4200, bulk_price: 4350, bulk_min: 100 },
          { id: "o3", poster_id: "b2", product: "maize", product_words: "Maize C", price: 5000 },
          { id: "o4", poster_id: "b1", product: "urea", product_words: "Urea", price: 3800 },
        ],
      },
    });
    const prices = await mcpSellClient.listPrices("maize");
    expect(prices.map((p) => [p.id, p.buyer, p.price])).toEqual([
      ["o1", "Kisumu Grain Traders", 4200],
      ["o2", "Kisumu Grain Traders", 3900],
    ]);
    expect(prices[0]).toMatchObject({ bulkPrice: 4350, bulkFrom: 100 });
    spy.mockRestore();
  });

  it("lists only the open group sales of the product, not group orders to buy", async () => {
    const spy = answer({
      market_list_group_orders: {
        items: [
          { id: "g1", poster_id: "b1", product: "maize", price: 4350, minimum: 100, state: "open", direction: "sell" },
          { id: "g2", poster_id: "b1", product: "maize", price: 3600, minimum: 20, state: "open", direction: "buy" },
          { id: "g3", poster_id: "b1", product: "maize", price: 4350, minimum: 100, state: "closed", direction: "sell" },
          { id: "g4", poster_id: "b1", product: "beans", price: 9000, minimum: 10, state: "open", direction: "sell" },
        ],
      },
    });
    expect(await mcpSellClient.listGroupSales("maize")).toEqual([
      { id: "g1", buyerId: "b1", product: "maize", price: 4350, from: 100 },
    ]);
    spy.mockRestore();
  });

  it("finds an open group sale that sits on the second page of orders", async () => {
    const filler = Array.from({ length: 200 }, (_, n) => ({ id: `g${String(n).padStart(4, "0")}`, product: "beans", state: "open", direction: "sell" }));
    const spy = vi.spyOn(mcp, "callTool").mockImplementation((async (_hub: string, _tool: string, args: Record<string, unknown>) =>
      args.after ? { items: [{ id: "g0200", poster_id: "b1", product: "maize", price: 4350, minimum: 100, state: "open", direction: "sell" }] } : { items: filler }) as any);
    expect(await mcpSellClient.listGroupSales("maize")).toEqual([{ id: "g0200", buyerId: "b1", product: "maize", price: 4350, from: 100 }]);
    expect(spy.mock.calls.map((args) => args[2])).toEqual([
      { limit: 200, state: "open" },
      { limit: 200, state: "open", after: "g0199" },
    ]);
    spy.mockRestore();
  });
});
