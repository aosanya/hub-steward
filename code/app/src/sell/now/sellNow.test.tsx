import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import * as mcp from "../../wakala/mcp";
import { mcpSellClient, sellNowTool, statusOf, type BuyerPrice, type Sale, type SellClient } from "./api";
import { SalePage } from "./SalePage";
import { SellNowPage } from "./SellNowPage";

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
const refused: Sale = { ...waiting, state: "cancelled" };

const clientOf = (sale: Sale): SellClient => ({
  listProducts: vi.fn().mockResolvedValue([]),
  listPrices: vi.fn().mockResolvedValue([kisumu]),
  listGroupSales: vi.fn().mockResolvedValue([]),
  sellNow: vi.fn().mockResolvedValue(sale),
  getSale: vi.fn().mockResolvedValue(sale),
  bookSale: vi.fn().mockResolvedValue(undefined),
});

const show = (entry: string, client: SellClient) =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/sell/:productId" element={<p>The maize page</p>} />
        <Route path="/sell/:productId/now/:offerId" element={<SellNowPage client={client} />} />
        <Route path="/sell/sale/:saleId" element={<SalePage client={client} />} />
      </Routes>
    </MemoryRouter>,
  );

describe("sell now", () => {
  it("sells the bags to the buyer picked and lands on the sale waiting for his yes", async () => {
    const client = clientOf(waiting);
    show("/sell/maize/now/o1", client);
    expect(await screen.findByText("KES 4,200 a bag")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Bags"), "40");
    await userEvent.click(screen.getByRole("button", { name: "Sell now" }));
    expect(client.sellNow).toHaveBeenCalledWith("o1", 40);
    expect(await screen.findByText("I asked Kisumu Grain Traders once about 40 bags of Dry maize 90kg. His yes is his own.")).toBeInTheDocument();
    expect(client.getSale).toHaveBeenCalledWith("a1");
  });

  it("asks for whole bags before selling anything", async () => {
    const client = clientOf(waiting);
    show("/sell/maize/now/o1", client);
    await userEvent.click(await screen.findByRole("button", { name: "Sell now" }));
    expect(await screen.findByText("Enter how many bags.")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Bags"), "2.5");
    await userEvent.click(screen.getByRole("button", { name: "Sell now" }));
    expect(client.sellNow).not.toHaveBeenCalled();
  });

  it("keeps the form and says so when the sale is refused", async () => {
    const client = clientOf(waiting);
    (client.sellNow as any).mockRejectedValue(new Error("refused"));
    show("/sell/maize/now/o1", client);
    await userEvent.type(await screen.findByLabelText("Bags"), "40");
    await userEvent.click(screen.getByRole("button", { name: "Sell now" }));
    expect(await screen.findByText("Could not sell. Try again.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sell now" })).toBeEnabled();
  });

  it("says when the price is no longer posted", async () => {
    const client = clientOf(waiting);
    show("/sell/maize/now/gone", client);
    expect(await screen.findByText("This price could not be found.")).toBeInTheDocument();
  });
});

describe("the sale", () => {
  it("names the product in the words of the buyers' prices for it", async () => {
    const client = clientOf(waiting);
    show("/sell/sale/a1", client);
    expect(await screen.findByRole("heading", { name: "40 bags of Dry maize 90kg" })).toBeInTheDocument();
    expect(client.listPrices).toHaveBeenCalledWith("maize");
  });

  it("names the product as the data holds it when the buyers' prices cannot be read", async () => {
    const client = clientOf(waiting);
    (client.listPrices as any).mockRejectedValue(new Error("down"));
    show("/sell/sale/a1", client);
    expect(await screen.findByRole("heading", { name: "40 bags of maize" })).toBeInTheDocument();
    expect(screen.getByText("I asked Kisumu Grain Traders once about 40 bags of maize. His yes is his own.")).toBeInTheDocument();
  });

  it("waits with no way to say yes for the buyer", async () => {
    show("/sell/sale/a1", clientOf(waiting));
    expect(await screen.findByText("Waiting")).toBeInTheDocument();
    expect(screen.queryByText("Yes")).toBeNull();
    expect(screen.getAllByRole("button").map((b) => b.getAttribute("aria-label") ?? b.textContent)).toEqual(["Back", "Menu", "Cancel the sale"]);
    expect(screen.queryByText("His date")).toBeNull();
  });

  it("shows his yes with his date, the price it was made at and the total", async () => {
    show("/sell/sale/a1", clientOf(said));
    expect(await screen.findByText("Yes")).toBeInTheDocument();
    expect(screen.getByText("Kisumu Grain Traders said yes.")).toBeInTheDocument();
    expect(screen.getByText("Friday, 6 Nov")).toBeInTheDocument();
    expect(screen.getByText("KES 4,200 a bag, the price when you sold")).toBeInTheDocument();
    expect(screen.getByText("KES 168,000")).toBeInTheDocument();
  });

  it("makes the order from his yes once, when the yes has no order yet", async () => {
    const client = clientOf({ ...said, orderId: "" });
    show("/sell/sale/a1", client);
    await screen.findByText("Kisumu Grain Traders said yes.");
    await waitFor(() => expect(client.bookSale).toHaveBeenCalledTimes(1));
    expect(client.bookSale).toHaveBeenCalledWith(expect.objectContaining({ id: "a1", yesId: "y1", offerId: "o1", quantity: 40 }));
  });

  it("does not make an order while the buyer has not answered", async () => {
    const client = clientOf(waiting);
    show("/sell/sale/a1", client);
    await screen.findByText("Waiting");
    expect(client.bookSale).not.toHaveBeenCalled();
  });

  it("shows his no as no, not as a yes", async () => {
    show("/sell/sale/a1", clientOf({ ...waiting, answer: "no" }));
    expect(await screen.findByText("Kisumu Grain Traders said no.")).toBeInTheDocument();
    expect(screen.getByText("No")).toBeInTheDocument();
  });

  it("shows a refused sale as cancelled and not as a yes", async () => {
    show("/sell/sale/a1", clientOf(refused));
    expect(await screen.findByText("Cancelled")).toBeInTheDocument();
    expect(screen.queryByText("Yes")).toBeNull();
  });

  it("says when the sale could not be loaded", async () => {
    const client = clientOf(waiting);
    (client.getSale as any).mockRejectedValue(new Error("down"));
    show("/sell/sale/a1", client);
    expect(await screen.findByText("This sale could not be loaded.")).toBeInTheDocument();
  });

  it("reads a date as yes and a cancelled order as cancelled, whatever the date", () => {
    expect(statusOf(waiting)).toBe("Waiting");
    expect(statusOf(said)).toBe("Yes");
    expect(statusOf({ ...said, state: "cancelled" })).toBe("Cancelled");
  });
});

describe("the sell client's writes", () => {
  const declared: Record<string, string[]> = {
    market_list_offers: [],
    market_list_posters: [],
    market_list_yeses: [],
    market_list_orders: [],
    market_list_asks: [],
    market_create_wanted: ["wanted", "quantity"],
    market_ask: ["poster_id", "offer_id", "request_id", "kind", "product", "question"],
    market_buy_now: ["offerID", "quantity", "yes_id"],
  };

  const fake = (calls: Array<[string, any]>, answer = "waiting", words = "") =>
    vi.spyOn(mcp, "callTool").mockImplementation((async (_hub: string, tool: string, args: any) => {
      calls.push([tool, args]);
      const undeclared = Object.keys(args ?? {}).filter((name) => !(declared[tool] ?? []).includes(name));
      if (undeclared.length > 0) throw new Error(`${tool} does not declare ${undeclared.join(", ")}`);
      if (tool === "market_list_posters") return { items: [{ id: "b1", name: "Kisumu Grain Traders", status: "approved" }] };
      if (tool === "market_list_offers") return { items: [{ id: "o1", poster_id: "b1", product: "maize", unit_words: "bag", ...(words ? { product_words: words } : {}), price: 4200, bulk_min: 100, bulk_price: 4000 }] };
      if (tool === "market_create_wanted") return { id: "r1" };
      if (tool === "market_ask") return { id: "a1" };
      if (tool === "market_list_asks")
        return { items: [{ id: "a1", poster_id: "b1", offer_id: "o1", kind: "sale", product: "maize", question: "40 bags of maize", answer }] };
      return { items: [] };
    }) as any);

  it("asks the buyer about the product in his own words, and still names it by its key", async () => {
    const calls: Array<[string, any]> = [];
    const spy = fake(calls, "waiting", "Dry maize 90kg");
    await mcpSellClient.sellNow("o1", 40);
    expect(calls).toContainEqual(["market_create_wanted", { wanted: "40 bags of Dry maize 90kg", quantity: 40 }]);
    expect(calls).toContainEqual([
      "market_ask",
      { poster_id: "b1", offer_id: "o1", request_id: "r1", kind: "sale", product: "maize", question: "40 bags of Dry maize 90kg" },
    ]);
    spy.mockRestore();
  });

  it("sells by asking the buyer once, through a request of its own, and never orders", async () => {
    const calls: Array<[string, any]> = [];
    const spy = fake(calls);
    const sale = await mcpSellClient.sellNow("o1", 40);
    expect(sellNowTool).toBe("market_ask");
    expect(calls).toContainEqual(["market_create_wanted", { wanted: "40 bags of maize", quantity: 40 }]);
    expect(calls).toContainEqual([
      "market_ask",
      { poster_id: "b1", offer_id: "o1", request_id: "r1", kind: "sale", product: "maize", question: "40 bags of maize" },
    ]);
    expect(calls.map(([tool]) => tool)).not.toContain("market_buy_now");
    expect(sale).toMatchObject({ id: "a1", buyer: "Kisumu Grain Traders", quantity: 40, unitPrice: 4200, promisedDate: "", orderId: "" });
    spy.mockRestore();
  });

  it("reads the sale from the ask, the yes and the order it became", async () => {
    const spy = vi.spyOn(mcp, "callTool").mockImplementation((async (_hub: string, tool: string) => {
      if (tool === "market_list_posters") return { items: [{ id: "b1", name: "Kisumu Grain Traders" }] };
      if (tool === "market_list_offers") return { items: [{ id: "o1", poster_id: "b1", product: "maize", price: 4200 }] };
      if (tool === "market_list_asks") return { items: [{ id: "a1", poster_id: "b1", offer_id: "o1", kind: "sale", product: "maize", question: "40 bags of maize", answer: "yes" }] };
      if (tool === "market_list_yeses") return { items: [{ id: "y1", ask_id: "a1", date: "2026-11-06" }] };
      if (tool === "market_list_orders") return { items: [{ id: "or1", yes_id: "y1", quantity: 40, unit_price: 4150, state: "placed", promised_date: "2026-11-06" }] };
      return { items: [] };
    }) as any);
    expect(await mcpSellClient.getSale("a1")).toMatchObject({ id: "a1", yesId: "y1", orderId: "or1", unitPrice: 4150, promisedDate: "2026-11-06", state: "placed" });
    spy.mockRestore();
  });

  it("makes the order from the yes with the market's declared names", async () => {
    const calls: Array<[string, any]> = [];
    const spy = fake(calls);
    await mcpSellClient.bookSale({ ...said, orderId: "" });
    expect(calls).toContainEqual(["market_buy_now", { offerID: "o1", quantity: 40, yes_id: "y1" }]);
    spy.mockRestore();
  });
});
