import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ApplyPage } from "../pages/supply/ApplyPage";
import { OfferFormPage } from "../pages/supply/OfferFormPage";
import { OffersPage } from "../pages/supply/OffersPage";
import { kes, mcpSupplyClient, offerOf, priceWords, productSlug, supplierOf, type Supplier, type SupplyClient, type SupplyOffer } from "./api";
import { SupplierHome } from "./SupplierHome";
import * as mcp from "../wakala/mcp";

const supplier = (status: string, owner = "m1"): Supplier => ({
  id: "p1",
  shop: "Kisumu Agro Supplies",
  area: "Kisumu",
  sells: "Fertiliser and seed",
  owner,
  status,
  approvedBy: "",
  ownerName: "",
  approvedByName: "",
});

const urea: SupplyOffer = { id: "o1", supplierId: "p1", product: "Urea 50kg", unit: "bag", price: 3800, bulkFrom: 20, bulkPrice: 3600 };
const dap: SupplyOffer = { id: "o2", supplierId: "p1", product: "DAP 50kg", unit: "bag", price: 4500, bulkFrom: 0, bulkPrice: 0 };

const clientOf = (suppliers: Supplier[], offers: SupplyOffer[] = []): SupplyClient => ({
  listSuppliers: vi.fn().mockResolvedValue(suppliers),
  applySupplier: vi.fn().mockResolvedValue(supplier("pending")),
  listOffers: vi.fn().mockResolvedValue(offers),
  createOffer: vi.fn().mockResolvedValue(urea),
  updateOffer: vi.fn().mockResolvedValue(urea),
});

const show = (entry: string, client: SupplyClient) =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/" element={<SupplierHome client={client} me="m1" />} />
        <Route path="/supply/apply" element={<ApplyPage client={client} me="m1" />} />
        <Route path="/offers" element={<OffersPage client={client} me="m1" />} />
        <Route path="/offers/new" element={<OfferFormPage client={client} me="m1" />} />
        <Route path="/offers/:offerId" element={<OfferFormPage client={client} me="m1" />} />
      </Routes>
    </MemoryRouter>,
  );

describe("apply as a supplier", () => {
  it("sends the shop, area and what he sells, then shows the waiting application", async () => {
    const client = clientOf([]);
    (client.listSuppliers as any).mockResolvedValueOnce([]).mockResolvedValue([supplier("pending")]);
    show("/supply/apply", client);
    await userEvent.type(await screen.findByLabelText("Shop name"), "Kisumu Agro Supplies");
    await userEvent.type(screen.getByLabelText("Area"), "Kisumu");
    await userEvent.type(screen.getByLabelText("What you sell"), "Fertiliser and seed");
    await userEvent.click(screen.getByRole("button", { name: "Send application" }));
    expect(client.applySupplier).toHaveBeenCalledWith({ shop: "Kisumu Agro Supplies", area: "Kisumu", sells: "Fertiliser and seed" });
    expect(await screen.findByText("Waiting on the group coordinator")).toBeInTheDocument();
    expect(screen.getByText("Asked")).toBeInTheDocument();
  });

  it("asks for a shop name before sending", async () => {
    const client = clientOf([]);
    show("/supply/apply", client);
    await userEvent.click(await screen.findByRole("button", { name: "Send application" }));
    expect(screen.getByText("Say the name of your shop.")).toBeInTheDocument();
    expect(client.applySupplier).not.toHaveBeenCalled();
  });

  it("shows an application that is waiting instead of the form", async () => {
    show("/supply/apply", clientOf([supplier("pending")]));
    expect(await screen.findByText("Waiting on the group coordinator")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send application" })).not.toBeInTheDocument();
  });

  it("does not show another member's application as his own", async () => {
    show("/supply/apply", clientOf([supplier("pending", "someone-else")]));
    expect(await screen.findByRole("button", { name: "Send application" })).toBeInTheDocument();
  });

  it("says the application was not sent when the tool fails", async () => {
    const client = clientOf([]);
    (client.applySupplier as any).mockRejectedValue(new Error("no"));
    show("/supply/apply", client);
    await userEvent.type(await screen.findByLabelText("Shop name"), "Shop");
    await userEvent.click(screen.getByRole("button", { name: "Send application" }));
    expect(await screen.findByText("Your application was not sent. Try again.")).toBeInTheDocument();
  });
});

describe("supplier Do Something", () => {
  beforeEach(() => {
    vi.spyOn(mcp, "callTool").mockImplementation(async (_agency: string, tool: string) => {
      if (tool === "agency_list_my_open_steps") return { items: [] };
      throw new Error("down");
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("gains the four supplier cards only once approved", async () => {
    show("/", clientOf([supplier("approved")]));
    expect(await screen.findByRole("button", { name: /^Orders/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Offers/ })).toBeInTheDocument();
  });

  it("keeps the plain Do Something while the application waits", async () => {
    const client = clientOf([supplier("pending")]);
    show("/", client);
    await waitFor(() => expect(client.listSuppliers).toHaveBeenCalled());
    expect(await screen.findByRole("button", { name: /^Forms/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Orders/ })).not.toBeInTheDocument();
  });

  it("keeps the plain Do Something when the supplier list cannot be read", async () => {
    const client = clientOf([]);
    (client.listSuppliers as any).mockRejectedValue(new Error("down"));
    show("/", client);
    expect(await screen.findByRole("button", { name: /^Forms/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Orders/ })).not.toBeInTheDocument();
  });
});

describe("offers", () => {
  it("lists his offers in his own words with price and bulk price", async () => {
    const client = clientOf([supplier("approved")], [urea, dap]);
    show("/offers", client);
    expect(await screen.findByText("Urea 50kg")).toBeInTheDocument();
    expect(screen.getByText("KES 3,800 a bag · 20 or more KES 3,600")).toBeInTheDocument();
    expect(screen.getByText("KES 4,500 a bag")).toBeInTheDocument();
    expect(screen.getByText("Offers · 2")).toBeInTheDocument();
    expect(client.listOffers).toHaveBeenCalledWith("p1");
  });

  it("carries the act inside the empty state", async () => {
    show("/offers", clientOf([supplier("approved")], []));
    expect(await screen.findByText("No offers yet")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Add an offer" }));
    expect(await screen.findByLabelText("Product, in your words")).toBeInTheDocument();
  });

  it("sends a supplier who is not approved to his application", async () => {
    const client = clientOf([supplier("pending")]);
    show("/offers", client);
    expect(await screen.findByText(/Offers open once/)).toBeInTheDocument();
    expect(client.listOffers).not.toHaveBeenCalled();
  });

  it("adds an offer with the typed numbers and returns to the list", async () => {
    const client = clientOf([supplier("approved")], []);
    show("/offers/new", client);
    await userEvent.type(await screen.findByLabelText("Product, in your words"), "Urea 50kg");
    await userEvent.type(screen.getByLabelText("Unit"), "bag");
    await userEvent.type(screen.getByLabelText("Price (KES)"), "3,800");
    await userEvent.type(screen.getByLabelText("Bulk from"), "20");
    await userEvent.type(screen.getByLabelText("Bulk price (KES)"), "3600");
    await userEvent.click(screen.getByRole("button", { name: "Save offer" }));
    expect(client.createOffer).toHaveBeenCalledWith("p1", { product: "Urea 50kg", group: "urea-50kg", unit: "bag", price: 3800, bulkFrom: 20, bulkPrice: 3600 });
    expect(await screen.findByText("No offers yet")).toBeInTheDocument();
  });

  it("refuses a price that is not a number and a bulk price without a bulk minimum", async () => {
    const client = clientOf([supplier("approved")], []);
    show("/offers/new", client);
    await userEvent.type(await screen.findByLabelText("Product, in your words"), "Urea");
    await userEvent.type(screen.getByLabelText("Price (KES)"), "lots");
    await userEvent.click(screen.getByRole("button", { name: "Save offer" }));
    expect(screen.getByText("Give the price as a number.")).toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText("Price (KES)"));
    await userEvent.type(screen.getByLabelText("Price (KES)"), "100");
    await userEvent.type(screen.getByLabelText("Bulk price (KES)"), "90");
    await userEvent.click(screen.getByRole("button", { name: "Save offer" }));
    expect(screen.getByText("Give both bulk from and bulk price, or neither.")).toBeInTheDocument();
    expect(client.createOffer).not.toHaveBeenCalled();
  });

  it("opens a row in the form and saves the whole offer with the changed price", async () => {
    const client = clientOf([supplier("approved")], [urea]);
    show("/offers/o1", client);
    const price = await screen.findByLabelText("Price (KES)");
    expect(price).toHaveValue("3800");
    await userEvent.clear(price);
    await userEvent.type(price, "3900");
    await userEvent.click(screen.getByRole("button", { name: "Save offer" }));
    expect(client.updateOffer).toHaveBeenCalledWith({ ...urea, group: "urea-50kg", price: 3900 });
  });
});

describe("the approval line", () => {
  it("names who approved once approved", async () => {
    show("/supply/apply", clientOf([{ ...supplier("approved"), approvedBy: "g1", approvedByName: "Grace Adhiambo" }]));
    expect(await screen.findByText("Approved by Grace Adhiambo")).toBeInTheDocument();
  });

  it("names no one while waiting", async () => {
    show("/supply/apply", clientOf([supplier("pending")]));
    expect(await screen.findByText("Waiting on the group coordinator")).toBeInTheDocument();
    expect(screen.queryByText(/Approved by/)).not.toBeInTheDocument();
  });
});

describe("the market tools", () => {
  it("reads the real field names of a poster and an offer", () => {
    expect(supplierOf({ id: "p", name: "Shop", area: "A", posts: "Seed", owner: "m", status: "approved", approved_by: "g", owner_name: "Peter Otieno", approved_by_name: "Grace Adhiambo" })).toEqual({
      id: "p", shop: "Shop", area: "A", sells: "Seed", owner: "m", status: "approved", approvedBy: "g", ownerName: "Peter Otieno", approvedByName: "Grace Adhiambo",
    });
    expect(offerOf({ id: "o", poster_id: "p", product_words: "Urea", unit_words: "bag", price: 10, bulk_min: 5, bulk_price: 8 })).toEqual({
      id: "o", supplierId: "p", product: "Urea", unit: "bag", price: 10, bulkFrom: 5, bulkPrice: 8,
    });
    expect(priceWords(dap)).toBe("KES 4,500 a bag");
  });

  it("calls market_apply_poster, market_create_offer and market_update_offer with the declared body", async () => {
    const call = vi.spyOn(mcp, "callTool").mockResolvedValue({});
    await mcpSupplyClient.applySupplier({ shop: "S", area: "A", sells: "X" });
    await mcpSupplyClient.createOffer("p1", { product: "Urea", unit: "bag", price: 1, bulkFrom: 0, bulkPrice: 0 });
    await mcpSupplyClient.updateOffer(urea);
    expect(call).toHaveBeenNthCalledWith(1, "", "market_apply_poster", { name: "S", area: "A", posts: "X" });
    expect(call).toHaveBeenNthCalledWith(2, "", "market_create_offer", { poster_id: "p1", product_words: "Urea", unit_words: "bag", price: 1, bulk_min: 0, bulk_price: 0 });
    expect(call.mock.calls[2][1]).toBe("market_update_offer");
    expect(call.mock.calls[2][2]).toMatchObject({ offerID: "o1", poster_id: "p1", price: 3800 });
    expect(call.mock.calls[2][2]).not.toHaveProperty("id");
    call.mockRestore();
  });
});

describe("the member id against a live api", () => {
  it("finds the member's own application from /me when none is injected", async () => {
    const { forgetSubject } = await import("../wakala/me");
    const { setRuntimeConfig, forgetRuntimeConfig } = await import("../wakala/config");
    forgetSubject();
    setRuntimeConfig({ wakala: "https://api.example" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ subject: "m1", agencies: [] }) }));
    const client = clientOf([supplier("approved", "m9"), supplier("pending", "m1")]);
    render(
      <MemoryRouter>
        <ApplyPage client={client} />
      </MemoryRouter>,
    );
    expect(await screen.findByText("Waiting on the group coordinator")).toBeInTheDocument();
    vi.unstubAllGlobals();
    forgetSubject();
    forgetRuntimeConfig();
  });
});

const maize: SupplyOffer = { id: "o9", supplierId: "p1", product: "Dry maize 90kg", unit: "bag", price: 4200, bulkFrom: 100, bulkPrice: 4350 };

const showBuyer = (entry: string, client: SupplyClient) =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/prices" element={<OffersPage client={client} me="m1" buyer />} />
        <Route path="/prices/new" element={<OfferFormPage client={client} me="m1" buyer />} />
        <Route path="/prices/:offerId" element={<OfferFormPage client={client} me="m1" buyer />} />
        <Route path="/offers" element={<p>supplier offers</p>} />
      </Routes>
    </MemoryRouter>,
  );

describe("a buyer posts a price", () => {
  it("lists his prices with the bulk price in the design's words", async () => {
    showBuyer("/prices", clientOf([supplier("approved")], [maize]));
    expect(await screen.findByRole("heading", { name: "Your prices" })).toBeInTheDocument();
    expect(screen.getByText("Dry maize 90kg")).toBeInTheDocument();
    expect(screen.getByText("KES 4,200 a bag · KES 4,350 from 100 bags")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Stock list" })).not.toBeInTheDocument();
  });

  it("posts the product in his words with the price and the bulk price, then returns to his prices", async () => {
    const client = clientOf([supplier("approved")], []);
    (client.listOffers as any).mockResolvedValueOnce([]).mockResolvedValue([maize]);
    showBuyer("/prices", client);
    await userEvent.click(await screen.findByRole("button", { name: "Post a price" }));
    await userEvent.type(await screen.findByLabelText("Product, in your words"), "Dry maize 90kg");
    await userEvent.type(screen.getByLabelText("Unit"), "bag");
    await userEvent.type(screen.getByLabelText("Price (KES)"), "4200");
    await userEvent.type(screen.getByLabelText("Bulk from"), "100");
    await userEvent.type(screen.getByLabelText("Bulk price (KES)"), "4350");
    await userEvent.click(screen.getByRole("button", { name: "Post price" }));
    expect(client.createOffer).toHaveBeenCalledWith("p1", { product: "Dry maize 90kg", group: "dry-maize-90kg", unit: "bag", price: 4200, bulkFrom: 100, bulkPrice: 4350 });
    expect(await screen.findByText("KES 4,200 a bag · KES 4,350 from 100 bags")).toBeInTheDocument();
    expect(screen.queryByText("supplier offers")).not.toBeInTheDocument();
  });

  it("edits a posted price through the same update tool", async () => {
    const client = clientOf([supplier("approved")], [maize]);
    showBuyer("/prices/o9", client);
    const price = await screen.findByLabelText("Price (KES)");
    await userEvent.clear(price);
    await userEvent.type(price, "4300");
    await userEvent.click(screen.getByRole("button", { name: "Post price" }));
    await waitFor(() => expect(client.updateOffer).toHaveBeenCalledWith({ ...maize, group: "dry-maize-90kg", price: 4300 }));
  });

  it("files the price under the product slug the market already knows, so it shows on that product's page", async () => {
    const client = { ...clientOf([supplier("approved")], []), listProducts: vi.fn().mockResolvedValue(["maize", "beans"]) };
    showBuyer("/prices/new", client);
    await userEvent.type(await screen.findByLabelText("Product, in your words"), "Maize");
    await userEvent.type(screen.getByLabelText("Unit"), "bag");
    await userEvent.type(screen.getByLabelText("Price (KES)"), "4000");
    await userEvent.click(screen.getByRole("button", { name: "Post price" }));
    expect(client.createOffer).toHaveBeenCalledWith("p1", expect.objectContaining({ product: "Maize", group: "maize" }));
  });

  it("does not file a shop's own product under a market slug because it shares one word", async () => {
    const client = { ...clientOf([supplier("approved")], []), listProducts: vi.fn().mockResolvedValue(["maize", "beans"]) };
    showBuyer("/prices/new", client);
    await userEvent.type(await screen.findByLabelText("Product, in your words"), "Maize seed 2kg");
    await userEvent.type(screen.getByLabelText("Unit"), "bag");
    await userEvent.type(screen.getByLabelText("Price (KES)"), "900");
    await userEvent.click(screen.getByRole("button", { name: "Post price" }));
    expect(client.createOffer).toHaveBeenCalledWith("p1", expect.objectContaining({ product: "Maize seed 2kg", group: "maize-seed-2kg" }));
  });

  it("keeps the slug an edited price already has while its words stay the same", async () => {
    const grouped = { ...maize, group: "maize" };
    const client = { ...clientOf([supplier("approved")], [grouped]), listProducts: vi.fn().mockResolvedValue(["beans"]) };
    showBuyer("/prices/o9", client);
    await screen.findByLabelText("Price (KES)");
    await userEvent.click(screen.getByRole("button", { name: "Post price" }));
    await waitFor(() => expect(client.updateOffer).toHaveBeenCalledWith(expect.objectContaining({ id: "o9", group: "maize" })));
  });
});

describe("the product slug and the money words", () => {
  it("matches a known slug only when the words are exactly that slug, else slugs the words", () => {
    expect(productSlug(" Maize ", ["beans", "maize"])).toBe("maize");
    expect(productSlug("Dry Maize 90kg", ["beans", "maize"])).toBe("dry-maize-90kg");
    expect(productSlug("Maizeflour", ["maize"])).toBe("maizeflour");
    expect(productSlug("Urea 50kg")).toBe("urea-50kg");
  });

  it("sends product beside product_words and reads it back as the group", async () => {
    const call = vi.spyOn(mcp, "callTool").mockResolvedValue({});
    await mcpSupplyClient.createOffer("p1", { product: "Maize, shelled", group: "maize", unit: "bag", price: 1, bulkFrom: 0, bulkPrice: 0 });
    expect(call).toHaveBeenCalledWith("", "market_create_offer", expect.objectContaining({ product_words: "Maize, shelled", product: "maize" }));
    call.mockRestore();
    expect(offerOf({ id: "o", poster_id: "p", product: "maize", product_words: "Maize" }).group).toBe("maize");
  });

  it("lists the distinct product slugs of every offer", async () => {
    const call = vi.spyOn(mcp, "callTool").mockResolvedValue({ items: [{ product: "maize" }, { product: "" }, { product: "maize" }, { product: "beans" }] });
    expect(await mcpSupplyClient.listProducts!()).toEqual(["maize", "beans"]);
    call.mockRestore();
  });

  it("formats money through the shared helper", () => {
    expect(kes(4200)).toBe("KES 4,200");
    expect(kes("4350")).toBe("KES 4,350");
  });
});

describe("the offers page with nothing to list, for the supplier and for the buyer", () => {
  const noAsks = { list: async () => [], offers: async () => [], answer: async () => undefined };

  const showOffers = (client: SupplyClient, buyer: boolean) =>
    render(
      <MemoryRouter initialEntries={["/list"]}>
        <Routes>
          <Route path="/list" element={<OffersPage client={client} asks={noAsks} me="m1" buyer={buyer} />} />
          <Route path="*" element={<p>elsewhere</p>} />
        </Routes>
      </MemoryRouter>,
    );

  it.each([
    [false, "Your offers could not be loaded."],
    [true, "Your prices could not be loaded."],
  ])("announces the failure for buyer %s in the failure card", async (buyer, words) => {
    const client = clientOf([supplier("approved")]);
    (client.listSuppliers as any).mockRejectedValue(new Error("down"));
    showOffers(client, buyer);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(words);
    expect(alert.closest(".card")).toHaveClass("empty");
  });

  it.each([
    [false, "Offers open once the group coordinator approves your application."],
    [true, "Prices open once the group coordinator approves your application."],
  ])("says for buyer %s that it opens once approved, with Your application inside the empty card", async (buyer, words) => {
    showOffers(clientOf([supplier("pending")]), buyer);
    const card = (await screen.findByText(words)).closest(".card") as HTMLElement;
    expect(card).toHaveClass("empty");
    expect(within(card).getByRole("button", { name: "Your application" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it.each([
    [false, "No offers yet", "Add an offer"],
    [true, "No prices yet", "Post a price"],
  ])("says for buyer %s that there is none yet, with %s inside the empty card", async (buyer, words, button) => {
    showOffers(clientOf([supplier("approved")], []), buyer);
    const card = (await screen.findByText(words)).closest(".card") as HTMLElement;
    expect(card).toHaveClass("empty");
    expect(within(card).getByText("Farmers see the prices you post, so they do not need to ask.")).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: button })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
