import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { Supplier, SupplyClient } from "../api";
import * as mcp from "../../wakala/mcp";
import { groupOrderOf, mcpGroupOrderClient, startedWithOf, tally, type GroupOrder, type GroupOrderClient } from "./api";
import { GroupOrderPage, GroupOrdersPage, ReviseGroupOrderPage } from "./GroupOrderPages";

const names = ["Asha Test", "Baraka Test", "Chebet Test", "Auma Test"];
const line = (i: number, quantity: number, answer: string) => ({ id: `l${i}`, picker: names[i], quantity, answer });

const open: GroupOrder = {
  id: "g1",
  posterId: "p1",
  product: "urea",
  productWords: "Urea 50kg",
  coordinator: "Grace Test",
  price: 3600,
  minimum: 20,
  termsVersion: 1,
  startedWith: null,
  state: "open",
  total: 8,
  count: 4,
  lines: [line(0, 2, "yes"), line(1, 3, "yes"), line(2, 2, "yes"), line(3, 1, "yes")],
};

const revising: GroupOrder = {
  ...open,
  price: 3700,
  termsVersion: 2,
  startedWith: { price: 3600, minimum: 20 },
  state: "revising",
  lines: [line(0, 2, "yes"), line(1, 3, "yes"), line(2, 2, "waiting"), line(3, 1, "no")],
};

const supplier: Supplier = { id: "p1", shop: "Shop", area: "Kisumu", sells: "Seed", owner: "m1", status: "approved", approvedBy: "", ownerName: "", approvedByName: "" };

const supplyOf = (suppliers: Supplier[]): SupplyClient => ({
  listSuppliers: vi.fn().mockResolvedValue(suppliers),
  applySupplier: vi.fn(),
  listOffers: vi.fn(),
  createOffer: vi.fn(),
  updateOffer: vi.fn(),
});

const clientOf = (orders: GroupOrder[]): GroupOrderClient => ({
  listGroupOrders: vi.fn().mockResolvedValue(orders),
  getGroupOrder: vi.fn().mockImplementation(async (id: string) => orders.find((o) => o.id === id)!),
  askRevision: vi.fn().mockResolvedValue(undefined),
});

const show = (entry: string, client: GroupOrderClient, supply = supplyOf([supplier])) =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/" element={<p>home</p>} />
        <Route path="/group-orders" element={<GroupOrdersPage client={client} supply={supply} me="m1" />} />
        <Route path="/group-orders/:orderId" element={<GroupOrderPage client={client} />} />
        <Route path="/group-orders/:orderId/revise" element={<ReviseGroupOrderPage client={client} />} />
      </Routes>
    </MemoryRouter>,
  );

describe("group orders list", () => {
  it("lists only the open orders of this supplier", async () => {
    const other = { ...open, id: "g2", posterId: "p9" };
    const closed = { ...open, id: "g3", state: "closed" };
    show("/group-orders", clientOf([open, other, closed]));
    expect(await screen.findByText("KES 3,600 a bag from 20 bags")).toBeInTheDocument();
    expect(screen.getByText("Urea 50kg · 8 bags of 20")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Urea/ })).toHaveLength(1);
  });

  it("shows nothing before approval", async () => {
    show("/group-orders", clientOf([open]), supplyOf([{ ...supplier, status: "pending" }]));
    expect(await screen.findByText("No open group orders")).toBeInTheDocument();
  });

  it("says when the list could not be loaded", async () => {
    const client = clientOf([]);
    (client.listGroupOrders as any).mockRejectedValue(new Error("down"));
    show("/group-orders", client);
    expect(await screen.findByText("Your group orders could not be loaded.")).toBeInTheDocument();
  });
});

describe("one group order", () => {
  it("shows terms, bags and names with no contact, and offers to ask for a revision", async () => {
    show("/group-orders/g1", clientOf([open]));
    expect(await screen.findByText("KES 3,600 a bag from 20 bags")).toBeInTheDocument();
    expect(screen.getByText("8 of 20 bags")).toBeInTheDocument();
    expect(screen.getByText("4 farmers · started by Grace Test")).toBeInTheDocument();
    expect(await screen.findByText("Asha Test")).toBeInTheDocument();
    expect(screen.getByText("3 bags")).toBeInTheDocument();
    expect(screen.getByText("1 bag")).toBeInTheDocument();
    expect(screen.queryByText("Waiting")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ask the farmers to revise" })).toBeInTheDocument();
  });

  it("shows the new terms beside Started with and the tally of answers", async () => {
    show("/group-orders/g1", clientOf([revising]));
    expect(await screen.findByText("KES 3,700 a bag from 20 bags")).toBeInTheDocument();
    expect(screen.getByText("Urea 50kg · new terms")).toBeInTheDocument();
    expect(screen.getByText("KES 3,600 a bag from 20 bags")).toBeInTheDocument();
    expect(screen.getByText("Started with")).toBeInTheDocument();
    expect(screen.getByText("2 yes · 1 no · 1 waiting")).toBeInTheDocument();
    expect(await screen.findByText("Waiting")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ask the farmers to revise" })).not.toBeInTheDocument();
  });
});

describe("a long list of farmers", () => {
  const many = (n: number): GroupOrder => ({
    ...open,
    count: n,
    total: n,
    lines: Array.from({ length: n }, (_, i) => ({ id: `m${i}`, picker: `Farmer ${String(i).padStart(3, "0")}`, quantity: 1, answer: "yes" })),
  });

  it("shows 50 first, then 50 more on Show more", async () => {
    show("/group-orders/g1", clientOf([many(120)]));
    expect(await screen.findByText("Farmer 000")).toBeInTheDocument();
    expect(screen.getByText("Farmer 049")).toBeInTheDocument();
    expect(screen.queryByText("Farmer 050")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Show more" }));
    expect(await screen.findByText("Farmer 099")).toBeInTheDocument();
    expect(screen.queryByText("Farmer 100")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Show more" }));
    expect(await screen.findByText("Farmer 119")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Show more" })).not.toBeInTheDocument();
  });

  it("finds a farmer by name in the search box", async () => {
    show("/group-orders/g1", clientOf([many(120)]));
    await screen.findByText("Farmer 000");
    await userEvent.type(screen.getByLabelText("Search by name"), "farmer 007");
    expect(screen.getByText("Farmer 007")).toBeInTheDocument();
    expect(screen.queryByText("Farmer 008")).not.toBeInTheDocument();
  });
});

describe("ask the farmers to revise", () => {
  it("sends the price and the minimum bags, then returns to the order", async () => {
    const client = clientOf([open]);
    show("/group-orders/g1/revise", client);
    const price = await screen.findByLabelText("Price a bag (KES)");
    expect(price).toHaveValue("3600");
    await userEvent.clear(price);
    await userEvent.type(price, "3,700");
    await userEvent.click(screen.getByRole("button", { name: "Ask the farmers" }));
    expect(client.askRevision).toHaveBeenCalledWith("g1", { price: 3700, minimum: 20 });
    expect(await screen.findByText("8 of 20 bags")).toBeInTheDocument();
  });

  it("refuses a price that is not a number", async () => {
    const client = clientOf([open]);
    show("/group-orders/g1/revise", client);
    const price = await screen.findByLabelText("Price a bag (KES)");
    await userEvent.clear(price);
    await userEvent.type(price, "abc");
    await userEvent.click(screen.getByRole("button", { name: "Ask the farmers" }));
    expect(screen.getByText("Give the price a bag as a number.")).toBeInTheDocument();
    expect(client.askRevision).not.toHaveBeenCalled();
  });

  it("keeps the form and says so when the ask fails", async () => {
    const client = clientOf([open]);
    (client.askRevision as any).mockRejectedValue(new Error("no"));
    show("/group-orders/g1/revise", client);
    await userEvent.click(await screen.findByRole("button", { name: "Ask the farmers" }));
    expect(await screen.findByText("The farmers were not asked. Try again.")).toBeInTheDocument();
  });
});

describe("tool shapes", () => {
  it("reads a group order view the way the market module sends it", () => {
    const order = groupOrderOf({
      id: "g1",
      poster_id: "p1",
      product: "Urea 50kg",
      coordinator: "Grace Test",
      price: 3700,
      minimum: 20,
      terms_version: 2,
      terms_history: JSON.stringify([{ version: 1, price: 3600, minimum: 20 }]),
      state: "revising",
      total: 8,
      count: 4,
      lines: [{ id: "l1", picker: "Asha Test", quantity: 2, answer: "waiting" }],
    });
    expect(order.startedWith).toEqual({ price: 3600, minimum: 20 });
    expect(order.lines[0]).toEqual({ id: "l1", picker: "Asha Test", quantity: 2, answer: "waiting" });
    expect(tally(order.lines)).toEqual({ yes: 0, no: 0, waiting: 1 });
  });

  it("takes the first terms as Started with and survives a bad history", () => {
    expect(startedWithOf(JSON.stringify([{ version: 2, price: 1, minimum: 1 }, { version: 1, price: 3, minimum: 5 }]))).toEqual({ price: 3, minimum: 5 });
    expect(startedWithOf("not json")).toBeNull();
    expect(startedWithOf("")).toBeNull();
  });

  it("calls the three tools with the declared argument names", async () => {
    const spy = vi.spyOn(mcp, "callTool").mockResolvedValue({ items: [] });
    await mcpGroupOrderClient.listGroupOrders();
    await mcpGroupOrderClient.getGroupOrder("g1");
    await mcpGroupOrderClient.askRevision("g1", { price: 3700, minimum: 20 });
    expect(spy).toHaveBeenCalledWith("", "market_list_group_orders", { limit: 200 });
    expect(spy).toHaveBeenCalledWith("", "market_get_group_order", { groupOrderID: "g1" });
    expect(spy).toHaveBeenCalledWith("", "market_ask_revision", { groupOrderID: "g1", price: 3700, minimum: 20 });
    spy.mockRestore();
  });
});

describe("the supplier's group orders on later pages", () => {
  afterEach(() => vi.restoreAllMocks());

  it("lists an order that sits on the second page of orders", async () => {
    const raw = (id: string) => ({ id, poster_id: "p1", product: "urea", coordinator: "", price: 3600, minimum: 20, terms_version: 1, state: "open", total: 0, count: 0, lines: [] });
    const filler = Array.from({ length: 200 }, (_, n) => raw(`g${String(n).padStart(4, "0")}`));
    const spy = vi.spyOn(mcp, "callTool").mockImplementation((async (_hub: string, tool: string, args: Record<string, unknown>) => {
      if (tool !== "market_list_group_orders") return { items: [] };
      return args.after ? { items: [raw("g0200")] } : { items: filler };
    }) as any);
    const listed = await mcpGroupOrderClient.listGroupOrders();
    expect(listed).toHaveLength(201);
    expect(listed.at(-1)?.id).toBe("g0200");
    expect(spy.mock.calls.filter((args) => args[1] === "market_list_group_orders").map((args) => args[2])).toEqual([
      { limit: 200 },
      { limit: 200, after: "g0199" },
    ]);
  });
});

describe("the product's name", () => {
  const rawOrder = { id: "g1", poster_id: "p1", product: "urea", coordinator: "", price: 3600, minimum: 20, terms_version: 1, state: "open", total: 0, count: 0, lines: [] };
  const offers = {
    items: [
      { poster_id: "p2", product: "urea", product_words: "UREA 46%", price: 3000 },
      { poster_id: "p1", product: "urea", product_words: "Urea 50kg bag", price: 3900 },
      { poster_id: "p1", product: "urea", product_words: "Urea 50kg", price: 3800 },
      { poster_id: "p1", product: "dap", product_words: "DAP 50kg", price: 4500 },
    ],
  };

  const market = (offersReply: unknown) =>
    vi.spyOn(mcp, "callTool").mockImplementation(async (_hub, tool) => {
      if (tool === "actor_list_actors") return { items: [] };
      if (tool === "market_list_offers") {
        if (offersReply instanceof Error) throw offersReply;
        return offersReply;
      }
      return tool === "market_list_group_orders" ? { items: [rawOrder] } : rawOrder;
    });

  afterEach(() => vi.restoreAllMocks());

  it("is the words of the cheapest offer of the order's own shop, on one order and on the list", async () => {
    market(offers);
    expect((await mcpGroupOrderClient.getGroupOrder("g1")).productWords).toBe("Urea 50kg");
    expect((await mcpGroupOrderClient.listGroupOrders())[0].productWords).toBe("Urea 50kg");
  });

  it("is the key as the data holds it when the offers cannot be read", async () => {
    market(new Error("not allowed"));
    const order = await mcpGroupOrderClient.getGroupOrder("g1");
    expect(order.productWords).toBe("urea");
    expect(order.product).toBe("urea");
  });

  it("is empty when the order has no product", () => {
    expect(groupOrderOf({ ...rawOrder, product: "" }, new Map(), []).productWords).toBe("");
  });
});

describe("the coordinator's name", () => {
  const coordinatorId = "9f1c7d2e-4b8a-4c63-8e0f-5a2d6b7c1e34";

  const rawOrder = {
    id: "g1",
    poster_id: "p1",
    product: "Urea 50kg",
    coordinator: coordinatorId,
    price: 3600,
    minimum: 20,
    terms_version: 1,
    state: "open",
    total: 8,
    count: 4,
    lines: [],
  };

  const marketWithActors = (actors: unknown) =>
    vi.spyOn(mcp, "callTool").mockImplementation(async (_hub, tool) => {
      if (tool === "actor_list_actors") {
        if (actors instanceof Error) throw actors;
        return actors;
      }
      return tool === "market_list_group_orders" ? { items: [rawOrder] } : rawOrder;
    });

  const named = (display_name: string) => ({ items: [{ id: coordinatorId, display_name }] });

  afterEach(() => vi.restoreAllMocks());

  it("is the display name of her actor, on one order and on the list", async () => {
    marketWithActors(named("Grace Adhiambo"));
    expect((await mcpGroupOrderClient.getGroupOrder("g1")).coordinator).toBe("Grace Adhiambo");
    expect((await mcpGroupOrderClient.listGroupOrders())[0].coordinator).toBe("Grace Adhiambo");
  });

  it("is Group coordinator when her actor has an empty display name", async () => {
    marketWithActors(named(""));
    expect((await mcpGroupOrderClient.getGroupOrder("g1")).coordinator).toBe("Group coordinator");
    expect((await mcpGroupOrderClient.listGroupOrders())[0].coordinator).toBe("Group coordinator");
  });

  it("is Group coordinator when her actor is not in the list", async () => {
    marketWithActors({ items: [{ id: "someone-else", display_name: "Asha Otieno" }] });
    expect((await mcpGroupOrderClient.getGroupOrder("g1")).coordinator).toBe("Group coordinator");
  });

  it("is Group coordinator, and the order still opens, when the actors cannot be listed", async () => {
    marketWithActors(new Error("not allowed"));
    const order = await mcpGroupOrderClient.getGroupOrder("g1");
    expect(order.coordinator).toBe("Group coordinator");
    expect(order.product).toBe("Urea 50kg");
  });

  it("is empty when the order names no coordinator", () => {
    expect(groupOrderOf({ ...rawOrder, coordinator: "" }, new Map()).coordinator).toBe("");
  });

  it("reads the name from the map it is given", () => {
    expect(groupOrderOf(rawOrder, new Map([[coordinatorId, "Grace Adhiambo"]])).coordinator).toBe("Grace Adhiambo");
    expect(groupOrderOf(rawOrder, new Map()).coordinator).toBe("Group coordinator");
  });

  it("shows her name on the supplier's order page", async () => {
    marketWithActors(named("Grace Adhiambo"));
    show("/group-orders/g1", mcpGroupOrderClient);
    expect(await screen.findByText("4 farmers · started by Grace Adhiambo")).toBeInTheDocument();
  });

  it("shows Group coordinator, never her id, when her actor has no display name", async () => {
    marketWithActors(named(""));
    const { container } = show("/group-orders/g1", mcpGroupOrderClient);
    expect(await screen.findByText("4 farmers · started by Group coordinator")).toBeInTheDocument();
    expect(container.textContent).not.toContain(coordinatorId);
  });
});
