import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { forgetOpenAgency, openAgency } from "../../agency/open";
import { routes } from "../../routes";
import * as mcp from "../../wakala/mcp";
import { type PosterChoice, type StartClient, type StartStep } from "./api";
import { mcpProductsClient, noOfferWords, offeredProducts, resolveProduct, type ProductsClient } from "./products";
import { StartPage } from "./StartPages";

const step: StartStep = {
  id: "w1",
  title: "Start the urea group order",
  formName: "Urea group order",
  roleName: "Group coordinator",
  workflowName: "",
  agencyName: "Siaya Farmers' Group",
  questions: [
    { prompt: "Product", answerType: "free_text", helper: "" },
    { prompt: "Price a bag", answerType: "currency", helper: "" },
    { prompt: "Minimum bags", answerType: "number", helper: "" },
  ],
};

const poster: PosterChoice = { kind: "one", poster: { id: "p1", name: "Agro Shop" } };

const offerRaw = (product: string, words: string, posterId = "p1", price = "3600") => ({ poster_id: posterId, product, product_words: words, price });

const clientOf = (): StartClient & { start: ReturnType<typeof vi.fn> } => ({
  waiting: async () => [step],
  openSteps: async () => [step],
  poster: async () => poster,
  start: vi.fn(async () => ({ id: "g9" })),
});

const productsOf = (offers: ProductsClient["offers"]): ProductsClient & { offers: ReturnType<typeof vi.fn> } => ({ offers: vi.fn(offers) });

const fillAndStart = async (product: string) => {
  await userEvent.type(await screen.findByLabelText("Product"), product);
  await userEvent.type(screen.getByLabelText("Price a bag"), "3600");
  await userEvent.type(screen.getByLabelText("Minimum bags"), "20");
  await userEvent.click(screen.getByRole("button", { name: "Start" }));
};

const open = (client: StartClient, products: ProductsClient) =>
  render(
    <MemoryRouter initialEntries={[routes.start.path({ stepId: "w1" })]}>
      <Routes>
        <Route path={routes.start.pattern} element={<StartPage client={client} products={products} />} />
        <Route path="/coordinator/orders/:id" element={<p>order opened</p>} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => openAgency("farmers"));

afterEach(() => {
  vi.restoreAllMocks();
  forgetOpenAgency();
});

describe("the Product of the Start form is checked against the shop's offers", () => {
  const offers = async () => [
    { poster: "p1", product: "urea", words: "Urea 50kg", price: "3600" },
    { poster: "p1", product: "dap", words: "DAP 50kg", price: "4200" },
  ];

  it("does not start an order for a product no offer carries, and names what is offered", async () => {
    const client = clientOf();
    open(client, productsOf(offers));
    await fillAndStart("maize seed");
    expect(await screen.findByText("No shop offer matches that product. Offered: Urea 50kg, DAP 50kg.")).toBeInTheDocument();
    expect(client.start).not.toHaveBeenCalled();
  });

  it("starts the order with the offer's key when the typed text is that key", async () => {
    const client = clientOf();
    open(client, productsOf(offers));
    await fillAndStart("urea");
    expect(await screen.findByText("order opened")).toBeInTheDocument();
    expect(client.start).toHaveBeenCalledWith({ product: "urea", price: 3600, minimum: 20, posterId: "p1" });
  });

  it("starts the order with the offer's key when the typed text is the offer's words, in any case", async () => {
    const client = clientOf();
    open(client, productsOf(offers));
    await fillAndStart(" dap 50KG ");
    expect(await screen.findByText("order opened")).toBeInTheDocument();
    expect(client.start).toHaveBeenCalledWith({ product: "dap", price: 3600, minimum: 20, posterId: "p1" });
  });

  it("asks for the offers of the poster the order is for", async () => {
    const products = productsOf(offers);
    open(clientOf(), products);
    await screen.findByLabelText("Product");
    expect(products.offers).toHaveBeenCalledWith("p1");
  });

  it("starts as before when the shop has no offers to compare with", async () => {
    const client = clientOf();
    open(client, productsOf(async () => []));
    await fillAndStart("DAP 50kg");
    expect(await screen.findByText("order opened")).toBeInTheDocument();
    expect(client.start).toHaveBeenCalledWith({ product: "DAP 50kg", price: 3600, minimum: 20, posterId: "p1" });
  });

  it("starts as before when the offers could not be read", async () => {
    const client = clientOf();
    open(client, productsOf(async () => Promise.reject(new Error("down"))));
    await fillAndStart("DAP 50kg");
    expect(await screen.findByText("order opened")).toBeInTheDocument();
    expect(client.start).toHaveBeenCalledWith({ product: "DAP 50kg", price: 3600, minimum: 20, posterId: "p1" });
  });
});

describe("the offers of one shop", () => {
  it("lists each product once, named by the cheapest offer's words", () => {
    const offered = offeredProducts([
      { poster: "p1", product: "urea", words: "Urea 50kg", price: "3600" },
      { poster: "p1", product: "urea", words: "Urea bag", price: "4000" },
      { poster: "p1", product: "dap", words: "", price: "4200" },
    ]);
    expect(offered).toEqual([
      { key: "urea", words: "Urea 50kg" },
      { key: "dap", words: "dap" },
    ]);
  });

  it("finds a product by key before words, and nothing for other text", () => {
    const offered = [{ key: "urea", words: "Urea 50kg" }];
    expect(resolveProduct("UREA", offered)).toEqual(offered[0]);
    expect(resolveProduct("urea 50kg", offered)).toEqual(offered[0]);
    expect(resolveProduct("maize", offered)).toBeUndefined();
  });

  it("says what is offered", () => {
    expect(noOfferWords([{ key: "urea", words: "Urea 50kg" }])).toBe("No shop offer matches that product. Offered: Urea 50kg.");
  });

  it("reads market_list_offers for the poster and keeps only that poster's offers", async () => {
    const call = vi.spyOn(mcp, "callTool").mockResolvedValue({ items: [offerRaw("urea", "Urea 50kg"), offerRaw("dap", "DAP 50kg", "p2")] });
    expect(await mcpProductsClient.offers("p1")).toEqual([{ poster: "p1", product: "urea", words: "Urea 50kg", price: "3600" }]);
    expect(call).toHaveBeenCalledWith("", "market_list_offers", { poster_id: "p1" });
  });
});
