import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { MarketClient, Product } from "../../market/api";
import { AppThreadPage } from "./AppThreadPage";
import type { BuyerPrice, SellClient } from "../../sell/now/api";
import { marketSource, myOrders, notListed, onSale } from "./marketSource";
import { joinGroupPrompt, sellNowPrompt, sellSource } from "./sellSource";
import { forgetOpenAgency, openAgency } from "../../agency/open";

beforeEach(() => openAgency("farmers"));

afterEach(() => forgetOpenAgency());

const products: Product[] = [
  { id: "maize-seed", name: "Maize seed", shops: 3, fromPrice: "480" },
  { id: "dap", name: "DAP", shops: 2, fromPrice: "4100" },
  { id: "urea", name: "Urea", shops: 1, fromPrice: "3600" },
  { id: "can", name: "CAN", shops: 4, fromPrice: "3200" },
];

const clientOf = (list: Product[] = products): MarketClient => ({
  listProducts: vi.fn().mockResolvedValue(list),
  listOffers: vi.fn().mockResolvedValue([]),
  listGroupOrders: vi.fn().mockResolvedValue([]),
});

const open = (client: MarketClient = clientOf()) =>
  render(
    <MemoryRouter>
      <AppThreadPage appName="Buy inputs" agentName="Farmers' agent" source={marketSource(client)} />
    </MemoryRouter>,
  );

describe("the buy thread with the real blocks", () => {
  it("opens with the question, the three prompts and the first product cards", async () => {
    open();
    expect(await screen.findByText("What do you want to buy?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: onSale })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: notListed })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: myOrders })).toBeInTheDocument();
    expect(screen.getByText("Maize seed")).toBeInTheDocument();
    expect(screen.getByText("DAP")).toBeInTheDocument();
    expect(screen.getByText("3 shops sell it")).toBeInTheDocument();
    expect(screen.getByText("From 480 a bag")).toBeInTheDocument();
    expect(screen.queryByText("Urea")).not.toBeInTheDocument();
  });

  it("links a product card button to its shops", async () => {
    open();
    const links = await screen.findAllByRole("link", { name: "See the shops" });
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute("href", "/a/farmers/market/maize-seed");
    expect(links[1]).toHaveAttribute("href", "/a/farmers/market/dap");
  });

  it("reveals more products on Show more products", async () => {
    open();
    await screen.findByText("DAP");
    await userEvent.click(screen.getByRole("button", { name: "Show more products" }));
    expect(screen.getByText("Urea")).toBeInTheDocument();
    expect(screen.getByText("CAN")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Show more products" })).not.toBeInTheDocument();
  });

  it("adds a card linking to the wanted page when Something not listed is tapped", async () => {
    open();
    await userEvent.click(await screen.findByRole("button", { name: notListed }));
    expect(await screen.findByText("Tell the shops what you are looking for.")).toBeInTheDocument();
    expect(screen.getByText("Ask the shops")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ask for it" })).toHaveAttribute("href", "/buy/wanted");
  });

  it("shows the card of a product named in free text", async () => {
    open();
    await screen.findByText("DAP");
    await userEvent.type(screen.getByLabelText("Write to the Farmers' agent"), "urea{enter}");
    expect(await screen.findByText("These match what you wrote.")).toBeInTheDocument();
    expect(screen.getByText("Urea")).toBeInTheDocument();
    expect(screen.getByText("1 shop sells it")).toBeInTheDocument();
    expect(screen.getByText("From 3600 a bag")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "See the shops" }).at(-1)).toHaveAttribute("href", "/a/farmers/market/urea");
    expect(screen.queryByText("CAN")).not.toBeInTheDocument();
  });

  it("offers the wanted card when free text matches nothing", async () => {
    open();
    await screen.findByText("DAP");
    await userEvent.type(screen.getByLabelText("Write to the Farmers' agent"), "tractor{enter}");
    expect(await screen.findByText("I could not find that on sale. You can ask the shops for it.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ask for it" })).toHaveAttribute("href", "/buy/wanted");
  });
});

const beansPrice: BuyerPrice = {
  id: "o9",
  buyerId: "b1",
  buyer: "Kisumu Grain Traders",
  product: "beans",
  words: "Dry beans 90kg",
  unit: "bag",
  price: 9000,
  bulkPrice: 0,
  bulkFrom: 0,
};

const sellClientOf = (listPrices: SellClient["listPrices"]): SellClient => ({
  listProducts: vi.fn().mockResolvedValue([{ id: "maize", name: "Dry maize 90kg", shops: 1, fromPrice: "KES 4,200" }]),
  listPrices: vi.fn(listPrices),
  listGroupSales: vi.fn().mockResolvedValue([]),
  sellNow: vi.fn(),
  getSale: vi.fn(),
  bookSale: vi.fn(),
});

const openSell = (client: SellClient) =>
  render(
    <MemoryRouter>
      <AppThreadPage appName="Sell the harvest" agentName="Farmers' agent" source={sellSource(client)} />
    </MemoryRouter>,
  );

describe("the sell thread with the real blocks", () => {
  it("keeps the failure text under the greeting when the prices cannot load", async () => {
    openSell(sellClientOf(() => Promise.reject(new Error("down"))));
    expect(await screen.findByText("What do you want to sell?")).toBeInTheDocument();
    expect(await screen.findByText("The buyers' prices could not be loaded. Try again in a moment.")).toBeInTheDocument();
  });

  it("shows the buyers of the product she typed when she taps Sell now", async () => {
    openSell(sellClientOf((product) => Promise.resolve(product === "beans" ? [beansPrice] : [])));
    await screen.findByText("What do you want to sell?");
    await userEvent.type(screen.getByLabelText("Write to the Farmers' agent"), "beans{enter}");
    await userEvent.click(await screen.findByRole("button", { name: sellNowPrompt }));
    expect(await screen.findByText("Pick the buyer to sell to. The best price is first.")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: sellNowPrompt }).at(-1)).toHaveAttribute("href", "/sell/beans/now/o9");
  });

  it("offers only Sell now for the product she typed when no group sale is open", async () => {
    openSell(sellClientOf((product) => Promise.resolve(product === "beans" ? [beansPrice] : [])));
    await screen.findByText("What do you want to sell?");
    await userEvent.type(screen.getByLabelText("Write to the Farmers' agent"), "beans{enter}");
    await screen.findByText("Kisumu Grain Traders pays the most for Dry beans 90kg.");
    expect(screen.queryByRole("button", { name: joinGroupPrompt })).not.toBeInTheDocument();
  });
});
