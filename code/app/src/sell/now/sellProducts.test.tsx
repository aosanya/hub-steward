import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { Product } from "../../market/api";
import * as mcp from "../../wakala/mcp";
import { mcpSellClient, type BuyerPrice, type SellClient } from "./api";
import { sellTile } from "./routes";
import { SellProductsPage } from "./SellProductsPage";

const dryMaize: Product = { id: "maize", name: "Dry maize 90kg", shops: 2, fromPrice: "KES 3,900" };
const beans: Product = { id: "beans", name: "beans", shops: 1, fromPrice: "KES 9,000" };

const clientOf = (products: Product[]): SellClient => ({
  listProducts: vi.fn().mockResolvedValue(products),
  listPrices: vi.fn(),
  listGroupSales: vi.fn(),
  sellNow: vi.fn(),
  getSale: vi.fn(),
  bookSale: vi.fn(),
});

const showPage = (client: SellClient) =>
  render(
    <MemoryRouter initialEntries={["/sell"]}>
      <Routes>
        <Route path="/" element={<p>Do Something page</p>} />
        <Route path="/sell" element={<SellProductsPage client={client} />} />
        <Route path="/sell/:productId" element={<p>The prices page</p>} />
      </Routes>
    </MemoryRouter>,
  );

describe("the products buyers have posted prices for", () => {
  it("lists each product by the buyers' words with its shops and price", async () => {
    showPage(clientOf([dryMaize, beans]));
    expect(await screen.findByText("Dry maize 90kg")).toBeInTheDocument();
    expect(screen.getByText("2 shops · from KES 3,900")).toBeInTheDocument();
    expect(screen.getByText("beans")).toBeInTheDocument();
    expect(screen.getByText("1 shop · KES 9,000")).toBeInTheDocument();
  });

  it("opens the prices page of the product picked", async () => {
    showPage(clientOf([dryMaize, beans]));
    await userEvent.click(await screen.findByRole("button", { name: /^Dry maize 90kg/ }));
    expect(await screen.findByText("The prices page")).toBeInTheDocument();
  });

  it("says so when no buyer has posted a price", async () => {
    showPage(clientOf([]));
    expect(await screen.findByText("No buyer has posted a price yet.")).toBeInTheDocument();
  });

  it("says when the products could not be loaded", async () => {
    const client = clientOf([]);
    (client.listProducts as any).mockRejectedValue(new Error("down"));
    showPage(client);
    expect(await screen.findByText("The buyers' prices could not be loaded.")).toBeInTheDocument();
  });

  it("goes back to Do Something", async () => {
    showPage(clientOf([dryMaize]));
    await userEvent.click(await screen.findByRole("button", { name: "Back" }));
    expect(await screen.findByText("Do Something page")).toBeInTheDocument();
  });
});

describe("the Sell harvest tile", () => {
  it("opens the list of products, not one product", () => {
    expect(sellTile).toEqual({ label: "Sell harvest", path: "/sell" });
  });
});

describe("the sell client's product list", () => {
  const answer = (replies: Record<string, unknown>) =>
    vi.spyOn(mcp, "callTool").mockImplementation(async (_hub: string, tool: string) => (replies[tool] ?? { items: [] }) as any);

  it("names each product by its cheapest approved buyer's words and counts the approved buyers", async () => {
    const spy = answer({
      market_list_posters: {
        items: [
          { id: "b1", name: "Kisumu Grain Traders", status: "approved" },
          { id: "b2", name: "Siaya Millers", status: "approved" },
          { id: "b3", name: "Pending Millers", status: "pending" },
        ],
      },
      market_list_offers: {
        items: [
          { id: "o1", poster_id: "b1", product: "maize", product_words: "Dry maize 90kg", price: 4200 },
          { id: "o2", poster_id: "b2", product: "maize", product_words: "MAIZE grain (bag)", price: 3900 },
          { id: "o3", poster_id: "b3", product: "maize", product_words: "Pending maize", price: 1000 },
          { id: "o4", poster_id: "b1", product: "beans", product_words: "", price: 9000 },
        ],
      },
    });
    expect(await mcpSellClient.listProducts()).toEqual([
      { id: "maize", name: "MAIZE grain (bag)", shops: 2, fromPrice: "KES 3,900" },
      { id: "beans", name: "beans", shops: 1, fromPrice: "KES 9,000" },
    ]);
    spy.mockRestore();
  });
});

describe("naming a product from the prices a screen loaded", () => {
  const price = (words: string, amount: number): BuyerPrice => ({
    id: words,
    buyerId: "b1",
    buyer: "A",
    product: "maize",
    words,
    unit: "bag",
    price: amount,
    bulkPrice: 0,
    bulkFrom: 0,
  });

  it("reads the cheapest buyer's words", async () => {
    const { nameOfProduct } = await import("./api");
    expect(nameOfProduct("maize", [price("Dry maize 90kg", 4200), price("MAIZE grain (bag)", 3900)])).toBe("MAIZE grain (bag)");
  });

  it("gives the key as the data holds it when no buyer has words", async () => {
    const { nameOfProduct } = await import("./api");
    expect(nameOfProduct("maize", [])).toBe("maize");
  });
});
