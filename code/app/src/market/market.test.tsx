import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { MarketPage } from "../pages/market/MarketPage";
import { ProductPage } from "../pages/market/ProductPage";
import * as mcp from "../wakala/mcp";
import { mcpMarketClient, type MarketClient } from "./api";
import { routes } from "../routes";
import { forgetOpenAgency, openAgency } from "../agency/open";

beforeEach(() => openAgency("farmers"));

afterEach(() => forgetOpenAgency());

const client: MarketClient = {
  listProducts: vi.fn().mockResolvedValue([
    { id: "urea", name: "Urea", shops: 3, fromPrice: "KES 3,800" },
    { id: "can", name: "CAN", shops: 1, fromPrice: "KES 3,400" },
  ]),
  listOffers: vi.fn().mockResolvedValue([
    { id: "o1", posterId: "p1", product: "urea", shop: "Kisumu Agro Supplies", words: "Urea 50kg", unit: "bag", price: "3800", bulkPrice: "", bulkFrom: "" },
    { id: "o2", posterId: "p2", product: "urea", shop: "Siaya Farm Stores", words: "UREA 46% 50KG", unit: "bag", price: "3950", bulkPrice: "3750", bulkFrom: "30" },
    { id: "o3", posterId: "p3", product: "urea", shop: "Bondo Agrovet", words: "urea (bag)", unit: "bag", price: "4100", bulkPrice: "3900", bulkFrom: "50" },
  ]),
  listGroupOrders: vi.fn().mockResolvedValue([{ id: "g1", posterId: "p1", product: "urea", price: "3600", from: "20" }]),
};

const show = (entry: string) =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path={routes.market.pattern} element={<MarketPage client={client} />} />
        <Route path={routes.product.pattern} element={<ProductPage client={client} />} />
        <Route path="/buy/wanted" element={<p>the wanted page</p>} />
        <Route path="/my-orders" element={<p>the orders page</p>} />
      </Routes>
    </MemoryRouter>,
  );

describe("market", () => {
  it("lists the products with their shops and lowest price and opens one", async () => {
    show("/a/farmers/market");
    expect(await screen.findByText("3 shops · from KES 3,800")).toBeInTheDocument();
    expect(screen.getByText("1 shop · KES 3,400")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /^Urea/ }));
    expect(await screen.findByText("Kisumu Agro Supplies")).toBeInTheDocument();
  });

  it("shows each shop's row in its own words with price, bulk price and the open group order", async () => {
    show("/a/farmers/market/urea");
    expect(await screen.findByText("UREA 46% 50KG")).toBeInTheDocument();
    expect(screen.queryByText("urea (bag)")).toBeNull();
    expect(screen.getByText("KES 3,950 a bag")).toBeInTheDocument();
    expect(screen.getByText("Bulk price KES 3,750 a bag from 30 bags")).toBeInTheDocument();
    expect(screen.getByText("Group order open KES 3,600 a bag from 20 bags")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Buy now" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Join" })).toHaveLength(1);
  });

  it("shows the cheapest two shops first and the rest on request", async () => {
    show("/a/farmers/market/urea");
    await screen.findByText("Siaya Farm Stores");
    expect(screen.queryByText("urea (bag)")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Show 1 more shop" }));
    expect(screen.getByText("urea (bag)")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /more shop/ })).toBeNull();
  });

  it("writes every price with the currency and a thousands separator", async () => {
    show("/a/farmers/market/urea");
    await screen.findByText("Siaya Farm Stores");
    expect(screen.getByText("KES 3,800 a bag")).toBeInTheDocument();
    expect(screen.queryByText(/\b3800\b|\b3950\b/)).toBeNull();
  });

  it("shows a shop's bulk price on its own card wherever it has one, behind the fold too", async () => {
    show("/a/farmers/market/urea");
    await screen.findByText("Siaya Farm Stores");
    expect(screen.getAllByText(/^Bulk price/)).toHaveLength(1);
    await userEvent.click(screen.getByRole("button", { name: "Show 1 more shop" }));
    expect(screen.getAllByText(/^Bulk price/)).toHaveLength(2);
    expect(screen.getByText("Bulk price KES 3,900 a bag from 50 bags")).toBeInTheDocument();
  });

  it("needs no ask to see a posted price", async () => {
    show("/a/farmers/market/urea");
    await screen.findByText("Siaya Farm Stores");
    expect(screen.queryByRole("button", { name: /ask/i })).toBeNull();
  });

  it("opens the wanted form from the market page", async () => {
    show("/a/farmers/market");
    await userEvent.click(await screen.findByRole("button", { name: /Something not listed/ }));
    expect(await screen.findByText("the wanted page")).toBeInTheDocument();
  });

  it("opens my orders from the market page", async () => {
    show("/a/farmers/market");
    await userEvent.click(await screen.findByRole("button", { name: /My orders/ }));
    expect(await screen.findByText("the orders page")).toBeInTheDocument();
  });

  it("leaves out the word from when no offer of a product has a price", async () => {
    const unpriced: MarketClient = { ...client, listProducts: vi.fn().mockResolvedValue([{ id: "seed", name: "Seed", shops: 3, fromPrice: "" }]) };
    render(
      <MemoryRouter initialEntries={["/a/farmers/market"]}>
        <MarketPage client={unpriced} />
      </MemoryRouter>,
    );
    expect(await screen.findByText("3 shops")).toBeInTheDocument();
  });
});

describe("one name for a product on both screens", () => {
  let spy: { mockRestore: () => void } | undefined;
  afterEach(() => spy?.mockRestore());

  const readOffers = () =>
    (spy = vi.spyOn(mcp, "callTool").mockImplementation((async (_hub: string, tool: string) =>
      tool === "market_list_offers"
        ? { items: [{ id: "o1", poster_id: "p1", product: "urea", product_words: "Urea 50kg", price: 3800 }] }
        : { items: [] }) as never));

  it("lists the product by the shop's words, not by its key", async () => {
    readOffers();
    render(
      <MemoryRouter initialEntries={["/a/farmers/market"]}>
        <MarketPage client={mcpMarketClient} />
      </MemoryRouter>,
    );
    expect(await screen.findByText("Urea 50kg")).toBeInTheDocument();
    expect(screen.queryByText("Urea")).toBeNull();
    expect(screen.queryByText("urea")).toBeNull();
  });

  it("titles the product page with the same words", async () => {
    readOffers();
    render(
      <MemoryRouter initialEntries={["/a/farmers/market/urea"]}>
        <Routes>
          <Route path={routes.product.pattern} element={<ProductPage client={mcpMarketClient} />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByRole("heading", { level: 1, name: "Urea 50kg" })).toBeInTheDocument();
  });
});
