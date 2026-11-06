import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import * as mcp from "../../wakala/mcp";
import { BoughtOrderPage } from "./BoughtOrderPage";
import { GroupOrderPage } from "./GroupOrderPage";
import { JoinPage } from "./JoinPage";
import {
  changedTermsWords,
  lastSeenOf,
  groupOrderOf,
  mcpJoinClient,
  myLineOf,
  orderOf,
  type BoughtOrder,
  type JoinClient,
  type OpenGroupOrder,
} from "./api";
import { routes } from "../../routes";
import { forgetOpenAgency, openAgency } from "../../agency/open";

beforeEach(() => openAgency("farmers"));

afterEach(() => forgetOpenAgency());

const open: OpenGroupOrder = {
  id: "g1",
  posterId: "p1",
  product: "Urea",
  price: 3600,
  minimum: 20,
  state: "open",
  total: 16,
  count: 8,
  startedWith: null,
  lastSeen: null,
  date: "",
  note: "",
  mine: null,
};

const joined: OpenGroupOrder = { ...open, mine: { id: "l1", quantity: 2, answer: "yes", joinedAt: "2026-11-02T08:00:00Z", answeredVersion: 1 } };

const revising: OpenGroupOrder = {
  ...joined,
  price: 3700,
  state: "revising",
  startedWith: { price: 3600, minimum: 20 },
  lastSeen: { price: 3600, minimum: 20 },
  mine: { id: "l1", quantity: 2, answer: "waiting", joinedAt: "2026-11-02T08:00:00Z", answeredVersion: 1 },
};

const closed: OpenGroupOrder = { ...joined, price: 3700, state: "closed" };

const bought: BoughtOrder = { id: "o1", posterId: "p1", product: "Urea 50kg", quantity: 2, unitPrice: 3700, state: "placed", promisedDate: "2026-11-06" };

const clientOf = (order: OpenGroupOrder, extra: Partial<JoinClient> = {}): JoinClient => ({
  getGroupOrder: vi.fn().mockResolvedValue(order),
  shopName: vi.fn().mockResolvedValue("Kisumu Agro Supplies"),
  productNameAt: vi.fn().mockResolvedValue("Urea 50kg"),
  join: vi.fn().mockResolvedValue(undefined),
  answerRevision: vi.fn().mockResolvedValue(undefined),
  findMyOrder: vi.fn().mockResolvedValue(""),
  getOrder: vi.fn().mockResolvedValue(bought),
  ...extra,
});

const show = (entry: string, client: JoinClient) =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path={routes.product.pattern} element={<p>the product</p>} />
        <Route path={routes.market.pattern} element={<p>the market</p>} />
        <Route path={routes.groupOrder.pattern} element={<GroupOrderPage client={client} me="m1" />} />
        <Route path={routes.joinGroupOrder.pattern} element={<JoinPage client={client} me="m1" />} />
        <Route path={routes.boughtOrder.pattern} element={<BoughtOrderPage client={client} />} />
      </Routes>
    </MemoryRouter>,
  );

const page = "/a/farmers/market/urea/group-orders/g1";

describe("the open group order", () => {
  it("shows the terms, the total, the minimum and the count with a Join button", async () => {
    show(page, clientOf(open));
    expect(await screen.findByText("KES 3,600 a bag from 20 bags")).toBeInTheDocument();
    expect(screen.getByText("Kisumu Agro Supplies")).toBeInTheDocument();
    expect(within(screen.getByText("Bags so far").closest(".row") as HTMLElement).getByText("16")).toBeInTheDocument();
    expect(within(screen.getByText("Minimum").closest(".row") as HTMLElement).getByText("20 bags")).toBeInTheDocument();
    expect(within(screen.getByText("Farmers").closest(".row") as HTMLElement).getByText("8")).toBeInTheDocument();
    expect(screen.queryByText("Your bags")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Join the group order" })).toBeInTheDocument();
  });

  it("draws the shop as the sub line under the title, once, not in the body", async () => {
    show(page, clientOf(open));
    const shop = await screen.findByText("Kisumu Agro Supplies");
    const title = screen.getByRole("heading", { level: 1 });
    expect(title.nextElementSibling).toBe(shop);
    expect(screen.getByRole("banner")).not.toContainElement(title);
    expect(screen.getAllByText("Kisumu Agro Supplies")).toHaveLength(1);
  });

  it("titles the order with the shop's words for the product, then group order", async () => {
    const client = clientOf({ ...open, product: "urea" });
    show(page, client);
    expect(await screen.findByRole("heading", { level: 1, name: "Urea 50kg group order" })).toBeInTheDocument();
    expect(client.productNameAt).toHaveBeenCalledWith("p1", "urea");
    expect(screen.queryByText("urea group order")).not.toBeInTheDocument();
  });

  it("titles an order that names no product Group order and asks for no words", async () => {
    const client = clientOf({ ...open, product: "" });
    show(page, client);
    await screen.findByText("KES 3,600 a bag from 20 bags");
    expect(screen.getByRole("heading", { level: 1, name: "Group order" })).toBeInTheDocument();
    expect(client.productNameAt).not.toHaveBeenCalled();
  });

  it("titles the order with the product as the data holds it when the shop's words cannot be read", async () => {
    show(page, clientOf({ ...open, product: "urea" }, { productNameAt: vi.fn().mockRejectedValue(new Error("down")) }));
    expect(await screen.findByRole("heading", { level: 1, name: "urea group order" })).toBeInTheDocument();
  });

  it("shows her own bags and offers to change them once she has joined", async () => {
    show(page, clientOf(joined));
    expect(await screen.findByText("Your bags")).toBeInTheDocument();
    expect(within(screen.getByText("Your bags").closest(".row") as HTMLElement).getByText("2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Change my bags" })).toBeInTheDocument();
  });

  it("opens the join form from the button", async () => {
    show(page, clientOf(open));
    await userEvent.click(await screen.findByRole("button", { name: "Join the group order" }));
    expect(await screen.findByLabelText("How many bags")).toBeInTheDocument();
  });

  it("says so when the order could not be opened", async () => {
    show(page, clientOf(open, { getGroupOrder: vi.fn().mockRejectedValue(new Error("down")) }));
    expect(await screen.findByRole("alert")).toHaveTextContent("This group order could not be opened.");
  });

  it("still opens when the shop name cannot be read", async () => {
    show(page, clientOf(open, { shopName: vi.fn().mockRejectedValue(new Error("down")) }));
    expect(await screen.findByText("KES 3,600 a bag from 20 bags")).toBeInTheDocument();
  });
});

describe("what the server sends a coordinator", () => {
  const everyone = [
    { id: "l1", picker: "m1", picker_name: "Asha Test", quantity: 2, answer: "yes" },
    { id: "l2", picker: "m2", picker_name: "Baraka Test", quantity: 7, answer: "yes" },
    { id: "l3", picker: "m3", picker_name: "Chebet Test", quantity: 5, answer: "waiting" },
  ];

  it("keeps only her own line", () => {
    expect(myLineOf(everyone, "m1")).toEqual({ id: "l1", quantity: 2, answer: "yes", joinedAt: "", answeredVersion: 0 });
    expect(myLineOf(everyone, "")).toBeNull();
    expect(myLineOf(everyone, "m9")).toBeNull();
    expect(myLineOf(undefined, "m1")).toBeNull();
  });

  it("never renders another farmer's name or amount", async () => {
    const raw = { id: "g1", poster_id: "p1", product: "Urea", price: 3600, minimum: 20, state: "open", total: 14, count: 3, lines: everyone };
    const client = clientOf(open, { getGroupOrder: vi.fn().mockImplementation(async (_id: string, me: string) => groupOrderOf(raw, me)) });
    show(page, client);
    expect(await screen.findByText("Your bags")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/Baraka|Chebet|Asha/);
    expect(screen.queryByText("7")).not.toBeInTheDocument();
    expect(screen.queryByText("5")).not.toBeInTheDocument();
    expect(screen.queryByText("7 bags")).not.toBeInTheDocument();
    expect(screen.getByText("14")).toBeInTheDocument();
  });
});

describe("join", () => {
  it("sends her bags as a number and returns to the order", async () => {
    const client = clientOf(open);
    show(`${page}/join`, client);
    expect(await screen.findByText("KES 3,600 a bag from 20 bags")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("How many bags"), "2");
    await userEvent.click(screen.getByRole("button", { name: "Join" }));
    expect(client.join).toHaveBeenCalledWith("g1", 2);
    expect(await screen.findByRole("button", { name: "Join the group order" })).toBeInTheDocument();
  });

  it("starts from her current bags when she changes them", async () => {
    show(`${page}/join`, clientOf(joined));
    expect(await screen.findByLabelText("How many bags")).toHaveValue("2");
  });

  it.each(["", "0", "-1", "two", "1.5"])("refuses %j bags", async (value) => {
    const client = clientOf(open);
    show(`${page}/join`, client);
    const field = await screen.findByLabelText("How many bags");
    if (value) await userEvent.type(field, value);
    await userEvent.click(screen.getByRole("button", { name: "Join" }));
    expect(screen.getByText("Give the bags as a whole number.")).toBeInTheDocument();
    expect(client.join).not.toHaveBeenCalled();
  });

  it("keeps the form and says so when the join fails", async () => {
    const client = clientOf(open, { join: vi.fn().mockRejectedValue(new Error("no")) });
    show(`${page}/join`, client);
    await userEvent.type(await screen.findByLabelText("How many bags"), "2");
    await userEvent.click(screen.getByRole("button", { name: "Join" }));
    expect(await screen.findByText("Your bags were not sent. Try again.")).toBeInTheDocument();
    expect(screen.getByLabelText("How many bags")).toHaveValue("2");
  });

  it("offers no form once the order is no longer open", async () => {
    show(`${page}/join`, clientOf(closed));
    expect(await screen.findByText("This group order is not open to join.")).toBeInTheDocument();
    expect(screen.queryByLabelText("How many bags")).not.toBeInTheDocument();
  });
});

describe("the shop's ask to revise", () => {
  it("asks the question with the old terms and her share at the new price", async () => {
    show(page, clientOf(revising));
    expect(await screen.findByText("Do you accept KES 3,700 a bag from 20 bags?")).toBeInTheDocument();
    expect(screen.getByText("Started with KES 3,600 a bag from 20 bags")).toBeInTheDocument();
    expect(screen.getByText("Kisumu Agro Supplies changed its bulk price.")).toBeInTheDocument();
    expect(screen.getByText("KES 7,400")).toBeInTheDocument();
    expect(screen.getByText("2 bags")).toBeInTheDocument();
  });

  it("names the minimum when only the minimum changed", async () => {
    show(page, clientOf({ ...revising, price: 3600, minimum: 30 }));
    expect(await screen.findByText("Kisumu Agro Supplies changed its minimum.")).toBeInTheDocument();
  });

  it("names both when the price and the minimum changed", async () => {
    show(page, clientOf({ ...revising, minimum: 30 }));
    expect(await screen.findByText("Kisumu Agro Supplies changed its bulk price and minimum.")).toBeInTheDocument();
  });

  it("names only the minimum when the second revision changed only the minimum", async () => {
    show(page, clientOf({ ...revising, price: 3700, minimum: 30, startedWith: { price: 3600, minimum: 20 }, lastSeen: { price: 3700, minimum: 20 } }));
    expect(await screen.findByText("Kisumu Agro Supplies changed its minimum.")).toBeInTheDocument();
  });

  it("keeps the price in when a revision restores the original price", async () => {
    show(page, clientOf({ ...revising, price: 3600, minimum: 30, startedWith: { price: 3600, minimum: 20 }, lastSeen: { price: 3700, minimum: 20 } }));
    expect(await screen.findByText("Kisumu Agro Supplies changed its bulk price and minimum.")).toBeInTheDocument();
  });

  it("falls back to the terms when the first terms are not known", async () => {
    show(page, clientOf({ ...revising, lastSeen: null }));
    expect(await screen.findByText("Kisumu Agro Supplies changed its terms.")).toBeInTheDocument();
  });

  it("sends yes only from her own button, then reads the order again", async () => {
    const client = clientOf(revising);
    (client.getGroupOrder as any).mockResolvedValueOnce(revising).mockResolvedValue({ ...revising, mine: { id: "l1", quantity: 2, answer: "yes", joinedAt: "", answeredVersion: 2 } });
    show(page, client);
    expect(await screen.findByText(/Do you accept/)).toBeInTheDocument();
    expect(client.answerRevision).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Yes" }));
    expect(client.answerRevision).toHaveBeenCalledWith("g1", "yes");
    expect(await screen.findByText("Your answer")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Yes" })).not.toBeInTheDocument();
  });

  it("sends no from the No button", async () => {
    const client = clientOf(revising);
    show(page, client);
    await userEvent.click(await screen.findByRole("button", { name: "No" }));
    expect(client.answerRevision).toHaveBeenCalledWith("g1", "no");
  });

  it("sends nothing on its own: silence stays Waiting", async () => {
    const client = clientOf(revising);
    show(page, client);
    await screen.findByText(/Do you accept/);
    expect(client.answerRevision).not.toHaveBeenCalled();
    expect(client.join).not.toHaveBeenCalled();
  });

  it("says so and keeps the question when the answer is not sent", async () => {
    const client = clientOf(revising, { answerRevision: vi.fn().mockRejectedValue(new Error("no")) });
    show(page, client);
    await userEvent.click(await screen.findByRole("button", { name: "Yes" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Your answer was not sent. Try again.");
    expect(screen.getByRole("button", { name: "Yes" })).toBeInTheDocument();
  });

  it("shows no question to someone with no line", async () => {
    show(page, clientOf({ ...revising, mine: null }));
    expect(await screen.findByText("KES 3,700 a bag from 20 bags")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Yes" })).not.toBeInTheDocument();
  });

  it("shows her answer without buttons once she has answered no", async () => {
    show(page, clientOf({ ...revising, mine: { id: "l1", quantity: 2, answer: "no", joinedAt: "", answeredVersion: 0 } }));
    expect(await screen.findByText("No")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Yes" })).not.toBeInTheDocument();
  });
});

describe("the confirmed order", () => {
  it("shows the status, her share, the price and her total from the group order", async () => {
    show(page, clientOf(closed));
    expect(await screen.findByText("Confirmed")).toBeInTheDocument();
    expect(screen.getByText("2 bags")).toBeInTheDocument();
    expect(screen.getByText("KES 3,700 a bag")).toBeInTheDocument();
    expect(screen.getByText("KES 7,400")).toBeInTheDocument();
  });

  it("shows the shop's date and note when the group order carries them", async () => {
    show(page, clientOf({ ...closed, date: "2026-11-06", note: "Collect at the shop" }));
    expect(await screen.findByText("Friday, 6 Nov")).toBeInTheDocument();
    expect(screen.getByText("Collect at the shop")).toBeInTheDocument();
  });

  it("leaves the date and note out when the group order carries none", async () => {
    show(page, clientOf(closed));
    await screen.findByText("Confirmed");
    expect(screen.queryByText("Date")).not.toBeInTheDocument();
    expect(screen.queryByText("Note")).not.toBeInTheDocument();
  });

  it("links to her actual order once it is found, and opens it", async () => {
    const client = clientOf(closed, { findMyOrder: vi.fn().mockResolvedValue("o1") });
    show(page, client);
    await userEvent.click(await screen.findByRole("button", { name: "See my order" }));
    expect(client.findMyOrder).toHaveBeenCalledWith(closed, "m1");
    expect(await screen.findByText("Friday, 6 Nov")).toBeInTheDocument();
    expect(client.getOrder).toHaveBeenCalledWith("o1");
  });

  it("offers no link when her order is not found or cannot be looked up", async () => {
    show(page, clientOf(closed));
    await screen.findByText("Confirmed");
    expect(screen.queryByRole("button", { name: "See my order" })).not.toBeInTheDocument();
  });

  it("offers no link while the order is not confirmed", async () => {
    const client = clientOf(joined, { findMyOrder: vi.fn().mockResolvedValue("o1") });
    show(page, client);
    await screen.findByText("Your bags");
    expect(client.findMyOrder).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "See my order" })).not.toBeInTheDocument();
  });

  it("still shows Confirmed when the lookup of her order fails", async () => {
    show(page, clientOf(closed, { findMyOrder: vi.fn().mockRejectedValue(new Error("down")) }));
    expect(await screen.findByText("Confirmed")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "See my order" })).not.toBeInTheDocument();
  });

  it("says a cancelled order is cancelled", async () => {
    show(page, clientOf({ ...open, state: "cancelled" }));
    expect(await screen.findByText("This group order is cancelled.")).toBeInTheDocument();
  });

  it("shows her share, price and date from the order itself", async () => {
    const client = clientOf(open);
    show("/a/farmers/market/bought/o1", client);
    expect(await screen.findByText("Friday, 6 Nov")).toBeInTheDocument();
    expect(client.getOrder).toHaveBeenCalledWith("o1");
    expect(screen.getByText("2 bags")).toBeInTheDocument();
    expect(screen.getByText("KES 3,700 a bag")).toBeInTheDocument();
    expect(screen.getByText("KES 7,400")).toBeInTheDocument();
    expect(screen.getByText("Kisumu Agro Supplies")).toBeInTheDocument();
  });

  it("draws the shop as the sub line under the bought order's title", async () => {
    show("/a/farmers/market/bought/o1", clientOf(open));
    const shop = await screen.findByText("Kisumu Agro Supplies");
    const title = screen.getByRole("heading", { level: 1 });
    expect(title.nextElementSibling).toBe(shop);
    expect(screen.getByRole("banner")).not.toContainElement(title);
  });

  it("titles the bought order with the shop's words for the product, not its key", async () => {
    const client = clientOf(open, { getOrder: vi.fn().mockResolvedValue({ ...bought, product: "urea" }) });
    show("/a/farmers/market/bought/o1", client);
    expect(await screen.findByRole("heading", { level: 1, name: "Urea 50kg" })).toBeInTheDocument();
    expect(client.productNameAt).toHaveBeenCalledWith("p1", "urea");
  });

  it("titles the bought order Order when it names no product, and with the key when no words can be read", async () => {
    const none = show("/a/farmers/market/bought/o1", clientOf(open, { getOrder: vi.fn().mockResolvedValue({ ...bought, product: "" }) }));
    expect(await screen.findByRole("heading", { level: 1, name: "Order" })).toBeInTheDocument();
    none.unmount();
    show("/a/farmers/market/bought/o1", clientOf(open, { getOrder: vi.fn().mockResolvedValue({ ...bought, product: "urea" }), productNameAt: vi.fn().mockRejectedValue(new Error("down")) }));
    expect(await screen.findByRole("heading", { level: 1, name: "urea" })).toBeInTheDocument();
  });

  it("leaves the date out when the shop has not given one", async () => {
    show("/a/farmers/market/bought/o1", clientOf(open, { getOrder: vi.fn().mockResolvedValue({ ...bought, promisedDate: "" }) }));
    await screen.findByText("Your share");
    expect(screen.queryByText("Date")).not.toBeInTheDocument();
  });

  it("says so when the order could not be opened", async () => {
    show("/a/farmers/market/bought/o1", clientOf(open, { getOrder: vi.fn().mockRejectedValue(new Error("down")) }));
    expect(await screen.findByRole("alert")).toHaveTextContent("This order could not be opened.");
  });
});

describe("the status of a bought order", () => {
  it("shows no status until it knows whether the shop marked it paid, then shows Paid without a Yes first", async () => {
    let settle: (order: unknown) => void = () => {};
    const getOrder = vi.fn().mockReturnValue(new Promise((resolve) => (settle = resolve)));
    render(
      <MemoryRouter initialEntries={["/a/farmers/market/bought/o1"]}>
        <Routes>
          <Route path={routes.boughtOrder.pattern} element={<BoughtOrderPage client={clientOf(open)} orders={{ getOrder, getTrail: vi.fn().mockResolvedValue([]) }} me="m1" />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText("Your share")).toBeInTheDocument();
    expect(screen.queryByText("Status")).not.toBeInTheDocument();
    expect(screen.queryByText("Yes")).not.toBeInTheDocument();
    settle({ standing: "Paid" });
    expect(await screen.findByText("Paid")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
  });
});

describe("tool shapes", () => {
  it("reads a group order the way the market module sends it", () => {
    const order = groupOrderOf(
      {
        id: "g1",
        poster_id: "p1",
        product: "Urea",
        coordinator: "m7",
        price: 3700,
        minimum: 20,
        terms_version: 2,
        terms_history: JSON.stringify([{ version: 1, price: 3600, minimum: 20 }]),
        state: "revising",
        total: 16,
        count: 8,
        lines: [{ id: "l1", picker: "m1", quantity: 2, answer: "waiting" }],
      },
      "m1",
    );
    expect(order).toEqual({
      id: "g1",
      posterId: "p1",
      product: "Urea",
      price: 3700,
      minimum: 20,
      state: "revising",
      total: 16,
      count: 8,
      startedWith: { price: 3600, minimum: 20 },
      lastSeen: { price: 3600, minimum: 20 },
      date: "",
      note: "",
      mine: { id: "l1", quantity: 2, answer: "waiting", joinedAt: "", answeredVersion: 0 },
    });
  });

  it("reads an order the way the market module sends it", () => {
    expect(orderOf({ id: "o1", poster_id: "p1", product: "Urea 50kg", quantity: 2, unit_price: 3700, state: "placed", promised_date: "2026-11-06" })).toEqual(bought);
  });

  it("reads the date and note of a confirmed group order", () => {
    const order = groupOrderOf({ id: "g1", state: "closed", promised_date: "2026-11-06", note: "Collect at the shop" }, "m1");
    expect(order.date).toBe("2026-11-06");
    expect(order.note).toBe("Collect at the shop");
  });

  it("names what changed between the first terms and the new ones", () => {
    const started = { price: 3600, minimum: 20 };
    expect(changedTermsWords({ price: 3700, minimum: 20 }, started)).toBe("bulk price");
    expect(changedTermsWords({ price: 3600, minimum: 30 }, started)).toBe("minimum");
    expect(changedTermsWords({ price: 3700, minimum: 30 }, started)).toBe("bulk price and minimum");
    expect(changedTermsWords({ price: 3600, minimum: 20 }, started)).toBe("");
    expect(changedTermsWords({ price: 3700, minimum: 20 }, null)).toBe("");
  });

  it("compares with the terms of the version she last answered, else the previous revision", () => {
    const history = JSON.stringify([
      { version: 1, price: 3600, minimum: 20 },
      { version: 2, price: 3700, minimum: 20 },
      { version: 3, price: 3700, minimum: 30 },
    ]);
    expect(lastSeenOf(history, 2, 4)).toEqual({ price: 3700, minimum: 20 });
    expect(lastSeenOf(history, 1, 4)).toEqual({ price: 3600, minimum: 20 });
    expect(lastSeenOf(history, 0, 4)).toEqual({ price: 3700, minimum: 30 });
    expect(lastSeenOf(history, 9, 4)).toEqual({ price: 3700, minimum: 30 });
    expect(lastSeenOf(history, 0, 2)).toEqual({ price: 3600, minimum: 20 });
    expect(lastSeenOf("[]", 0, 2)).toBeNull();
    expect(lastSeenOf("nonsense", 1, 2)).toBeNull();
  });

  it("reads the terms she last saw from her answered version", () => {
    const raw = {
      id: "g1",
      price: 3700,
      minimum: 30,
      terms_version: 3,
      terms_history: JSON.stringify([
        { version: 1, price: 3600, minimum: 20 },
        { version: 2, price: 3700, minimum: 20 },
      ]),
      state: "revising",
      lines: [{ id: "l1", picker: "m1", quantity: 2, answer: "waiting", answered_version: 2 }],
    };
    const order = groupOrderOf(raw, "m1");
    expect(order.startedWith).toEqual({ price: 3600, minimum: 20 });
    expect(order.lastSeen).toEqual({ price: 3700, minimum: 20 });
    expect(order.mine?.answeredVersion).toBe(2);
    expect(groupOrderOf({ ...raw, lines: [{ id: "l1", picker: "m1", quantity: 2 }] }, "m1").lastSeen).toEqual({ price: 3700, minimum: 20 });
    expect(groupOrderOf(raw, "m2").lastSeen).toEqual({ price: 3700, minimum: 20 });
  });

  it("finds her order as the first live one at that shop after she joined", async () => {
    const raw = (id: string, over: Record<string, unknown> = {}) => ({
      id,
      picker: "m1",
      poster_id: "p1",
      product: "urea",
      quantity: 2,
      state: "placed",
      created_at: "2026-11-03T08:00:00Z",
      ...over,
    });
    const spy = vi.spyOn(mcp, "callTool").mockResolvedValue({
      items: [
        raw("early", { created_at: "2026-11-01T08:00:00Z" }),
        raw("other-shop", { poster_id: "p2" }),
        raw("other-picker", { picker: "m2" }),
        raw("cancelled", { state: "cancelled" }),
        raw("other-bags", { quantity: 3 }),
        raw("other-product", { product: "seed" }),
        raw("later", { created_at: "2026-11-05T08:00:00Z" }),
        raw("mine"),
      ],
    });
    expect(await mcpJoinClient.findMyOrder(closed, "m1")).toBe("mine");
    expect(spy).toHaveBeenCalledWith("", "market_list_orders", {});
    expect(await mcpJoinClient.findMyOrder({ ...closed, mine: null }, "m1")).toBe("");
    expect(await mcpJoinClient.findMyOrder(closed, "")).toBe("");
    spy.mockResolvedValue({ items: [] });
    expect(await mcpJoinClient.findMyOrder(closed, "m1")).toBe("");
    spy.mockRestore();
  });

  it("compares timestamps as instants, not as text, and takes the one nearest after she joined", async () => {
    const joinedAt = "2026-11-02T08:00:05Z";
    const order = { ...closed, mine: { ...closed.mine!, joinedAt } };
    const raw = (id: string, created_at: string) => ({
      id,
      picker: "m1",
      poster_id: "p1",
      product: "urea",
      quantity: 2,
      state: "placed",
      created_at,
    });
    const spy = vi.spyOn(mcp, "callTool").mockResolvedValue({
      items: [
        raw("later", "2026-11-02T08:00:30.25Z"),
        raw("just-after", "2026-11-02T08:00:05.5Z"),
        raw("just-before", "2026-11-02T08:00:04.999999999Z"),
        raw("older-buy-now", "2026-10-20T08:00:05Z"),
        raw("unreadable", "yesterday"),
      ],
    });
    expect(await mcpJoinClient.findMyOrder(order, "m1")).toBe("just-after");
    spy.mockResolvedValue({ items: [raw("same-second", "2026-11-02T08:00:05Z"), raw("after", "2026-11-02T08:00:05.5Z")] });
    expect(await mcpJoinClient.findMyOrder(order, "m1")).toBe("same-second");
    spy.mockRestore();
  });

  it("looks for no order at all until the group order is closed or when her join time is unknown", async () => {
    const spy = vi.spyOn(mcp, "callTool").mockResolvedValue({
      items: [{ id: "o9", picker: "m1", poster_id: "p1", product: "urea", quantity: 2, state: "placed", created_at: "2026-11-03T08:00:00Z" }],
    });
    expect(await mcpJoinClient.findMyOrder({ ...closed, state: "revising" }, "m1")).toBe("");
    expect(await mcpJoinClient.findMyOrder({ ...closed, state: "open" }, "m1")).toBe("");
    expect(await mcpJoinClient.findMyOrder({ ...closed, mine: { ...closed.mine!, joinedAt: "" } }, "m1")).toBe("");
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("reads the words of the shop's cheapest offer for a product, else the product as the data holds it", async () => {
    const spy = vi.spyOn(mcp, "callTool").mockResolvedValue({
      items: [
        { id: "o1", poster_id: "p1", product: "urea", product_words: "Urea 50kg bag", price: 3900 },
        { id: "o2", poster_id: "p1", product: "urea", product_words: "Urea 50kg", price: 3800 },
        { id: "o3", poster_id: "p2", product: "urea", product_words: "Cheap urea", price: 3000 },
        { id: "o4", poster_id: "p1", product: "can", product_words: "CAN 50kg", price: 3400 },
      ],
    });
    expect(await mcpJoinClient.productNameAt("p1", "urea")).toBe("Urea 50kg");
    expect(await mcpJoinClient.productNameAt("p1", "seed")).toBe("seed");
    expect(await mcpJoinClient.productNameAt("p9", "urea")).toBe("urea");
    expect(spy).toHaveBeenCalledWith("", "market_list_offers", {});
    spy.mockRestore();
  });

  it("calls the tools with the declared argument names", async () => {
    const spy = vi.spyOn(mcp, "callTool").mockResolvedValue({ items: [{ id: "p1", name: "Kisumu Agro Supplies" }] });
    await mcpJoinClient.getGroupOrder("g1", "m1");
    await mcpJoinClient.join("g1", 2);
    await mcpJoinClient.answerRevision("g1", "yes");
    await mcpJoinClient.getOrder("o1");
    expect(await mcpJoinClient.shopName("p1")).toBe("Kisumu Agro Supplies");
    expect(await mcpJoinClient.shopName("p9")).toBe("");
    expect(spy).toHaveBeenCalledWith("", "market_get_group_order", { groupOrderID: "g1" });
    expect(spy).toHaveBeenCalledWith("", "market_join_group_order", { groupOrderID: "g1", quantity: 2 });
    expect(spy).toHaveBeenCalledWith("", "market_answer_revision", { groupOrderID: "g1", answer: "yes" });
    expect(spy).toHaveBeenCalledWith("", "market_get_order", { orderID: "o1" });
    expect(spy).toHaveBeenCalledWith("", "market_list_posters", {});
    spy.mockRestore();
  });
});
