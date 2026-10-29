import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { App } from "../App";
import { AppThreadPage } from "../apps/thread/AppThreadPage";
import { marketSource } from "../apps/thread/marketSource";
import * as mcp from "../wakala/mcp";
import { forgetSubject } from "../wakala/me";
import { forgetOpenAgency, openAgency } from "../agency/open";
import { answerWakala } from "./answerWakala";

beforeEach(() => openAgency("walk-agency"));

afterEach(() => forgetOpenAgency());

const ME = "m1";
const KISUMU = "p-kisumu";
const SIAYA = "p-siaya";
const BONDO = "p-bondo";

type Raw = Record<string, any>;

const termsHistory = (...terms: Array<[number, number, number]>) =>
  JSON.stringify(terms.map(([version, price, minimum]) => ({ version, price, minimum })));

const freshMarket = () => ({
  posters: [
    { id: KISUMU, name: "Kisumu Agro Supplies", status: "approved", availability: "open" },
    { id: SIAYA, name: "Siaya Farm Stores", status: "approved", availability: "open" },
    { id: BONDO, name: "Bondo Agrovet", status: "approved", availability: "open" },
  ] as Raw[],
  offers: [
    { id: "o1", poster_id: KISUMU, product_words: "Urea 50kg", unit_words: "bag", product: "urea", price: 3800 },
    { id: "o2", poster_id: SIAYA, product_words: "UREA 46% 50KG", unit_words: "bag", product: "urea", price: 3950, bulk_price: 3750, bulk_min: 30 },
    { id: "o3", poster_id: BONDO, product_words: "urea (bag)", unit_words: "bag", product: "urea", price: 4100 },
  ] as Raw[],
  group: {
    id: "g1",
    poster_id: KISUMU,
    coordinator: "m-grace",
    product: "urea",
    direction: "buy",
    state: "open",
    price: 3600,
    minimum: 20,
    terms_version: 1,
    terms_history: termsHistory([1, 3600, 20]),
    baseTotal: 14,
    baseCount: 7,
    mine: null as Raw | null,
  },
  orders: [] as Raw[],
  trails: {} as Record<string, Raw[]>,
  requests: [] as Raw[],
  asks: [] as Raw[],
  yeses: [] as Raw[],
  notices: [] as Raw[],
  calls: [] as Array<[string, Raw]>,
});

type Market = ReturnType<typeof freshMarket>;

const groupAsSeen = (market: Market) => {
  const { mine, baseTotal, baseCount, ...group } = market.group;
  return {
    ...group,
    total: baseTotal + (mine?.quantity ?? 0),
    count: baseCount + (mine ? 1 : 0),
    lines: mine ? [mine] : [],
  };
};

const reply = (market: Market) => async (_hub: string, tool: string, args: Raw = {}): Promise<any> => {
  market.calls.push([tool, args]);
  const orderId = args.orderID;
  switch (tool) {
    case "market_list_posters":
      return { items: market.posters };
    case "market_list_offers":
      return { items: market.offers };
    case "market_list_group_orders":
      return { items: [groupAsSeen(market)] };
    case "market_get_group_order":
      return groupAsSeen(market);
    case "market_join_group_order":
      market.group.mine = { id: "l-mine", picker: ME, quantity: Number(args.quantity), answer: "waiting", paid: false, created_at: "2026-11-02T08:00:00Z" };
      return market.group.mine;
    case "market_answer_revision":
      market.group.mine = { ...market.group.mine, answer: args.answer, answered_version: market.group.terms_version };
      return market.group.mine;
    case "market_buy_now": {
      const offer = market.offers.find((o) => o.id === args.offerID)!;
      const order = {
        id: "or1",
        picker: ME,
        poster_id: offer.poster_id,
        offer_id: offer.id,
        product: offer.product,
        quantity: Number(args.quantity),
        unit_price: offer.price,
        state: "placed",
        paid: false,
        promised_date: "",
        created_at: "2026-11-02T08:00:00Z",
      };
      market.orders.push(order);
      return order;
    }
    case "market_get_order":
      return market.orders.find((o) => o.id === orderId);
    case "market_cancel_order": {
      const order = market.orders.find((o) => o.id === orderId)!;
      order.state = "cancelled";
      return order;
    }
    case "market_list_orders":
      return { items: market.orders };
    case "market_order_trail":
      return { items: market.trails[orderId] ?? [] };
    case "market_create_wanted": {
      const request = { id: "r1", picker: ME, ...args };
      market.requests.push(request);
      return request;
    }
    case "market_ask": {
      const ask = { id: `a${market.asks.length + 1}`, answer: "", ...args };
      market.asks.push(ask);
      return ask;
    }
    case "market_list_asks":
      return { items: market.asks };
    case "market_list_yeses":
      return { items: market.yeses };
    case "market_create_notice": {
      const notice = { id: "n1", picker: ME, state: "open", ...args };
      market.notices.push(notice);
      return notice;
    }
    case "market_list_notices":
      return { items: market.notices };
    case "market_withdraw_notice":
      market.notices.find((n) => n.id === args.noticeID)!.state = "withdrawn";
      return {};
    default:
      throw new Error(`no such tool in this walk: ${tool}`);
  }
};

const Where = () => <output data-testid="where">{useLocation().pathname + useLocation().search}</output>;

const BuyInputsThread = () => (
  <AppThreadPage appName="Buy inputs" agentName="Farmers' agent" source={marketSource()} />
);

const at = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/apps/buy" element={<BuyInputsThread />} />
        <Route path="*" element={<App />} />
      </Routes>
      <Where />
    </MemoryRouter>,
  );

const where = () => screen.getByTestId("where").textContent ?? "";

const tapped = (name: string | RegExp) => userEvent.click(screen.getByRole("button", { name }));

const callsTo = (market: Market, tool: string) => market.calls.filter(([name]) => name === tool).map(([, args]) => args);

let market: Market;

beforeEach(() => {
  market = freshMarket();
  forgetSubject();
  vi.stubGlobal("fetch", answerWakala(() => ME, () => [{ id: "walk-agency", name: "Walk agency" }]));
  vi.spyOn(mcp, "callTool").mockImplementation(reply(market) as any);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("journey 13, step 1: opens the market", () => {
  it("asks what she wants to buy, finds urea by name and lists every shop's own words and price", async () => {
    at("/apps/buy");
    expect(await screen.findByText("What do you want to buy?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "What is on sale" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Something not listed" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "My orders" })).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Write to the Farmers' agent"), "urea");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText("These match what you wrote.")).toBeInTheDocument();
    const seeShops = screen.getAllByRole("link", { name: "See the shops" });
    await userEvent.click(seeShops[seeShops.length - 1]);

    expect(await screen.findByRole("heading", { name: "Urea 50kg" })).toBeInTheDocument();
    expect(where()).toBe("/a/walk-agency/market/urea");
    expect(screen.getByText("Kisumu Agro Supplies")).toBeInTheDocument();
    expect(screen.getByText("KES 3,800 a bag")).toBeInTheDocument();
    expect(screen.getByText("Siaya Farm Stores")).toBeInTheDocument();
    expect(screen.getByText("UREA 46% 50KG")).toBeInTheDocument();
    expect(screen.getByText("KES 3,950 a bag")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Buy now" })).toHaveLength(2);
    expect(screen.queryByText("Bondo Agrovet")).not.toBeInTheDocument();

    await tapped("Show 1 more shop");
    expect(screen.getByText("Bondo Agrovet")).toBeInTheDocument();
    expect(screen.getByText("urea (bag)")).toBeInTheDocument();
    expect(screen.getByText("KES 4,100 a bag")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Buy now" })).toHaveLength(3);
  });

  it("shows the bulk price under the shop that has one and the open group order with Join", async () => {
    at("/a/walk-agency/market/urea");
    expect(await screen.findByText("Bulk price KES 3,750 a bag from 30 bags")).toBeInTheDocument();
    expect(screen.getAllByText(/Bulk price/)).toHaveLength(1);
    expect(screen.getByText("Group order open KES 3,600 a bag from 20 bags")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Join" })).toHaveLength(1);
  });

  it("lists the market's products and opens one from its row, with Back returning to the market", async () => {
    at("/a/walk-agency/market");
    await userEvent.click(await screen.findByRole("button", { name: /Urea/ }));
    expect(await screen.findByRole("heading", { name: "Urea 50kg" })).toBeInTheDocument();
    expect(where()).toBe("/a/walk-agency/market/urea");
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(await screen.findByRole("heading", { name: "Market" })).toBeInTheDocument();
    expect(screen.getByText("3 shops · from KES 3,800")).toBeInTheDocument();
  });
});

describe("journey 13, the market's own doors", () => {
  it("opens Something not listed and My orders from the market", async () => {
    at("/a/walk-agency/market");
    await userEvent.click(await screen.findByRole("button", { name: /Something not listed/ }));
    expect(await screen.findByRole("heading", { name: "Something not listed" })).toBeInTheDocument();
    expect(where()).toBe("/buy/wanted");
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    await waitFor(() => expect(where()).toBe("/apps/buy"));
    await userEvent.click(await screen.findByRole("button", { name: "My orders" }));
    await screen.findByText("Here are your orders.");
    await userEvent.click(screen.getByRole("link", { name: "Open my orders" }));
    expect(await screen.findByRole("heading", { name: "My orders" })).toBeInTheDocument();
    expect(where()).toBe("/my-orders");
  });
});

describe("journey 13, step 2: buys now", () => {
  it("opens the shop's Buy now, orders 2 bags and lands on a waiting order with the price she saw", async () => {
    at("/a/walk-agency/market/urea");
    await screen.findByRole("heading", { name: "Urea 50kg" });
    await userEvent.click(screen.getAllByRole("button", { name: "Buy now" })[0]);

    expect(await screen.findByText("Urea 50kg · Kisumu Agro Supplies · KES 3,800 a bag")).toBeInTheDocument();
    expect(where()).toBe("/a/walk-agency/market/urea/buy/o1");
    await userEvent.type(screen.getByLabelText("How many bags"), "2");
    await userEvent.type(screen.getByLabelText("Needed by"), "2026-11-06");
    await tapped("Buy now");

    expect(await screen.findByText("Waiting")).toBeInTheDocument();
    expect(where()).toBe("/a/walk-agency/market/orders/or1");
    expect(screen.getByText("Kisumu Agro Supplies")).toBeInTheDocument();
    expect(screen.getByText("KES 3,800 a bag")).toBeInTheDocument();
    expect(screen.getByText("KES 7,600")).toBeInTheDocument();
    expect(screen.getByText("Friday, 6 Nov")).toBeInTheDocument();
    expect(screen.getByText("Asking Kisumu Agro Supplies about 2 bags.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(callsTo(market, "market_buy_now")).toHaveLength(1);
    expect(market.orders).toHaveLength(1);
    expect(market.orders[0]).toMatchObject({ quantity: 2, unit_price: 3800, poster_id: KISUMU });
  });

  it("shows Yes with the shop's date once the shop says yes, and Cancel is still offered", async () => {
    market.orders.push({ id: "or1", picker: ME, poster_id: KISUMU, offer_id: "o1", product: "urea", quantity: 2, unit_price: 3800, state: "placed", paid: false, promised_date: "2026-11-06", created_at: "2026-11-02T08:00:00Z" });
    at("/a/walk-agency/market/orders/or1");
    expect(await screen.findByText("Yes")).toBeInTheDocument();
    expect(screen.getByText("Shop's date")).toBeInTheDocument();
    expect(screen.getByText("Friday, 6 Nov")).toBeInTheDocument();
    expect(screen.getByText("KES 3,800 a bag")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("cancels at once and says it is telling the shop", async () => {
    market.orders.push({ id: "or1", picker: ME, poster_id: KISUMU, offer_id: "o1", product: "urea", quantity: 2, unit_price: 3800, state: "placed", paid: false, promised_date: "2026-11-06", created_at: "2026-11-02T08:00:00Z" });
    at("/a/walk-agency/market/orders/or1");
    await userEvent.click(await screen.findByRole("button", { name: "Cancel" }));
    expect(await screen.findByText("Cancelled")).toBeInTheDocument();
    expect(screen.getByText("Telling Kisumu Agro Supplies that you cancelled.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
    expect(market.orders[0].state).toBe("cancelled");
  });

  it("walks Buy now, the shop's yes and Cancel as one order", async () => {
    at("/a/walk-agency/market/urea/buy/o1");
    await userEvent.type(await screen.findByLabelText("How many bags"), "2");
    await userEvent.type(screen.getByLabelText("Needed by"), "2026-11-06");
    await tapped("Buy now");
    expect(await screen.findByText("Waiting")).toBeInTheDocument();
    market.orders[0].promised_date = "2026-11-06";
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(await screen.findByText("Cancelled")).toBeInTheDocument();
    expect(screen.getByText("Telling Kisumu Agro Supplies that you cancelled.")).toBeInTheDocument();
    expect(callsTo(market, "market_cancel_order")).toHaveLength(1);
  });
});

describe("journey 13, step 3: joins a group order", () => {
  it("opens the group order from Join and shows its terms, the bags so far and the farmers, without any other farmer", async () => {
    at("/a/walk-agency/market/urea");
    await userEvent.click(await screen.findByRole("button", { name: "Join" }));
    expect(await screen.findByRole("heading", { name: "Urea 50kg group order" })).toBeInTheDocument();
    expect(where()).toBe("/a/walk-agency/market/urea/group-orders/g1");
    expect(screen.getByText("Kisumu Agro Supplies")).toBeInTheDocument();
    const rows = within(screen.getByRole("main"));
    expect(rows.getByText("Terms").closest("li, div")).toHaveTextContent("KES 3,600 a bag from 20 bags");
    expect(rows.getByText("Bags so far").closest("li, div")).toHaveTextContent("14");
    expect(rows.getByText("Farmers").closest("li, div")).toHaveTextContent("7");
    expect(screen.queryByText("m-grace")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Join the group order" })).toBeInTheDocument();
  });

  it("joins with 2 bags from a one-field form and comes back to the group order with her line", async () => {
    at("/a/walk-agency/market/urea/group-orders/g1");
    await userEvent.click(await screen.findByRole("button", { name: "Join the group order" }));
    expect(await screen.findByRole("heading", { name: "Join the group order" })).toBeInTheDocument();
    expect(where()).toBe("/a/walk-agency/market/urea/group-orders/g1/join");
    await userEvent.type(screen.getByLabelText("How many bags"), "2");
    await tapped("Join");
    expect(await screen.findByRole("button", { name: "Change my bags" })).toBeInTheDocument();
    expect(where()).toBe("/a/walk-agency/market/urea/group-orders/g1");
    expect(screen.getByText("Your bags").closest("li, div")).toHaveTextContent("2");
    expect(callsTo(market, "market_join_group_order")).toEqual([expect.objectContaining({ quantity: 2 })]);
  });

  it("refuses a half bag", async () => {
    at("/a/walk-agency/market/urea/group-orders/g1/join");
    await userEvent.type(await screen.findByLabelText("How many bags"), "1.5");
    await tapped("Join");
    expect(await screen.findByText("Give the bags as a whole number.")).toBeInTheDocument();
    expect(callsTo(market, "market_join_group_order")).toHaveLength(0);
  });

  it("asks her the revised terms as a question with the started-with terms and her share, and Yes is her own button", async () => {
    market.group.mine = { id: "l-mine", picker: ME, quantity: 2, answer: "waiting", paid: false, created_at: "2026-11-02T08:00:00Z" };
    market.group.state = "revising";
    market.group.price = 3700;
    market.group.terms_version = 2;
    market.group.terms_history = termsHistory([1, 3600, 20], [2, 3700, 20]);
    at("/a/walk-agency/market/urea/group-orders/g1");
    expect(await screen.findByText(/Kisumu Agro Supplies changed its/)).toBeInTheDocument();
    expect(screen.getByText("Do you accept KES 3,700 a bag from 20 bags?")).toBeInTheDocument();
    expect(screen.getByText("Started with KES 3,600 a bag from 20 bags")).toBeInTheDocument();
    expect(screen.getByText("Your share")).toBeInTheDocument();
    expect(screen.getByText("2 bags")).toBeInTheDocument();
    expect(screen.getByText("KES 7,400")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "No" })).toBeInTheDocument();

    await tapped("Yes");
    expect(await screen.findByText("Your answer")).toBeInTheDocument();
    expect(callsTo(market, "market_answer_revision")).toEqual([expect.objectContaining({ answer: "yes" })]);
    expect(screen.queryByRole("button", { name: "Yes" })).not.toBeInTheDocument();
  });

  it("shows Confirmed with her share, the confirmed price and the total once the group order is sent", async () => {
    market.group.mine = { id: "l-mine", picker: ME, quantity: 2, answer: "yes", answered_version: 2, paid: false, created_at: "2026-11-02T08:00:00Z" };
    market.group.state = "closed";
    market.group.price = 3700;
    market.group.terms_version = 2;
    market.group.terms_history = termsHistory([1, 3600, 20], [2, 3700, 20]);
    at("/a/walk-agency/market/urea/group-orders/g1");
    expect(await screen.findByText("Confirmed")).toBeInTheDocument();
    expect(screen.getByText("Your share").closest("li, div")).toHaveTextContent("2 bags");
    expect(screen.getByText("KES 3,700 a bag")).toBeInTheDocument();
    expect(screen.getByText("KES 7,400")).toBeInTheDocument();
  });
});

describe("journey 13, step 4: finds something not listed", () => {
  const fillTheForm = async () => {
    await userEvent.type(await screen.findByLabelText("What"), "Hybrid maize seed 614");
    await userEvent.type(screen.getByLabelText("How much"), "10");
    await userEvent.type(screen.getByLabelText("Needed by"), "2026-11-06");
  };

  it("reaches the form from the agent's Something not listed prompt", async () => {
    at("/apps/buy");
    await userEvent.click(await screen.findByRole("button", { name: "Something not listed" }));
    expect(await screen.findByText("Tell the shops what you are looking for.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("link", { name: "Ask for it" }));
    expect(await screen.findByRole("heading", { name: "Something not listed" })).toBeInTheDocument();
    expect(where()).toBe("/buy/wanted");
    expect(screen.getByRole("button", { name: "Ask shops" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Put up a notice" })).toBeDisabled();
  });

  it("asks the ticked shops once each and shows who said yes, no or has not answered", async () => {
    at("/buy/wanted");
    await fillTheForm();
    await tapped("Ask shops");

    expect(await screen.findByRole("heading", { name: "Ask shops" })).toBeInTheDocument();
    expect(callsTo(market, "market_create_wanted")).toEqual([expect.objectContaining({ wanted: "Hybrid maize seed 614", quantity: 10, needed_by: "2026-11-06" })]);
    expect(screen.getByText("Hybrid maize seed 614 · 10 · by Friday")).toBeInTheDocument();
    const boxes = await screen.findAllByRole("checkbox");
    expect(boxes).toHaveLength(3);
    boxes.forEach((box) => expect(box).toBeChecked());
    await userEvent.click(screen.getByRole("checkbox", { name: "Bondo Agrovet" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Bondo Agrovet" }));
    await tapped("Ask the ticked shops");

    expect(await screen.findByRole("heading", { name: "Hybrid maize seed 614" })).toBeInTheDocument();
    const asked = callsTo(market, "market_ask");
    expect(asked.map((a) => a.poster_id).sort()).toEqual([BONDO, KISUMU, SIAYA]);
    expect(asked.every((a) => a.request_id === "r1")).toBe(true);
    expect(await screen.findAllByText("Waiting")).toHaveLength(3);

    const url = where();
    market.asks.find((a) => a.poster_id === SIAYA)!.answer = "yes";
    market.asks.find((a) => a.poster_id === BONDO)!.answer = "no";
    market.yeses.push({ id: "y1", ask_id: market.asks.find((a) => a.poster_id === SIAYA)!.id, poster_id: SIAYA, picker: ME, what: "Hybrid maize seed 614", quantity: 10, date: "2026-11-06", note: "KES 1,850 for 10 kg", state: "open" });
    document.body.innerHTML = "";
    at(url);

    expect(await screen.findByText("Found for you")).toBeInTheDocument();
    expect(screen.getByText("Yes")).toBeInTheDocument();
    expect(screen.getByText("No")).toBeInTheDocument();
    expect(screen.getByText("Waiting")).toBeInTheDocument();
    expect(screen.getByText(/Hybrid maize seed 614 · 10 · by Friday/)).toBeInTheDocument();
  });

  it("skips an unticked shop", async () => {
    at("/buy/wanted");
    await fillTheForm();
    await tapped("Ask shops");
    await userEvent.click(await screen.findByRole("checkbox", { name: "Bondo Agrovet" }));
    await tapped("Ask the ticked shops");
    await screen.findByRole("heading", { name: "Hybrid maize seed 614" });
    expect(callsTo(market, "market_ask").map((a) => a.poster_id).sort()).toEqual([KISUMU, SIAYA]);
  });

  it("puts up a notice every shop can see and takes it down", async () => {
    at("/buy/wanted");
    await fillTheForm();
    await tapped("Put up a notice");

    expect(await screen.findByRole("heading", { name: "Your notice" })).toBeInTheDocument();
    expect(where()).toBe("/buy/notices/n1");
    expect(screen.getByText("Hybrid maize seed 614")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("Friday, 6 Nov")).toBeInTheDocument();
    expect(screen.getByText("Every shop")).toBeInTheDocument();

    await tapped("Take it down");
    await waitFor(() => expect(where()).toBe("/apps/buy"));
    expect(callsTo(market, "market_withdraw_notice")).toEqual([{ noticeID: "n1" }]);
  });
});

describe("journey 13, step 5: sees her orders", () => {
  const seedOrders = () => {
    market.group.state = "closed";
    market.group.price = 3700;
    market.group.terms_version = 2;
    market.group.terms_history = termsHistory([1, 3600, 20], [2, 3700, 20]);
    market.group.mine = { id: "l-mine", picker: ME, quantity: 2, answer: "yes", answered_version: 2, paid: true, created_at: "2026-11-02T08:00:00Z" };
    market.orders.push({ id: "or1", picker: ME, poster_id: KISUMU, offer_id: "o1", product: "urea", quantity: 2, unit_price: 3800, state: "cancelled", paid: false, promised_date: "2026-11-06", created_at: "2026-11-01T08:00:00Z" });
    market.trails.or1 = [
      { id: "t1", order_id: "or1", actor: ME, what: "placed", at: "2026-11-02T08:00:00Z" },
      { id: "t2", order_id: "or1", actor: ME, what: "cancelled", at: "2026-11-04T08:00:00Z" },
    ];
  };

  it("opens My orders from the agent and lists the group order and the Buy now with how and at what price", async () => {
    seedOrders();
    at("/apps/buy");
    await userEvent.click(await screen.findByRole("button", { name: "My orders" }));
    expect(await screen.findByText("Here are your orders.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("link", { name: "Open my orders" }));

    expect(await screen.findByRole("heading", { name: "My orders" })).toBeInTheDocument();
    expect(where()).toBe("/my-orders");
    const group = await screen.findByRole("button", { name: /Group order/ });
    const buyNow = screen.getByRole("button", { name: /Buy now/ });
    expect(group).toHaveTextContent("2 of Urea 50kg");
    expect(group).toHaveTextContent("KES 3,700 each");
    expect(group).toHaveTextContent("Paid");
    expect(buyNow).toHaveTextContent("2 of Urea 50kg");
    expect(buyNow).toHaveTextContent("KES 3,800 each");
    expect(buyNow).toHaveTextContent("Cancelled");
  });

  it("opens the group order with the supplier, her own share, the price, the total and the date", async () => {
    seedOrders();
    at("/my-orders");
    await userEvent.click(await screen.findByRole("button", { name: /Group order/ }));
    expect(await screen.findByText("Supplier")).toBeInTheDocument();
    expect(where()).toBe("/my-orders/group/g1");
    expect(screen.getByText("Kisumu Agro Supplies")).toBeInTheDocument();
    expect(screen.getByText("Your share").closest("li, div")).toHaveTextContent("2");
    expect(screen.getByText("KES 3,700 each")).toBeInTheDocument();
    expect(screen.getByText("KES 7,400")).toBeInTheDocument();
    expect(screen.getByText("Paid")).toBeInTheDocument();
  });

  it("opens the Buy now order with a trail of dated lines", async () => {
    seedOrders();
    at("/my-orders");
    await userEvent.click(await screen.findByRole("button", { name: /Buy now/ }));
    expect(await screen.findByRole("heading", { name: "Trail" })).toBeInTheDocument();
    expect(where()).toBe("/my-orders/or1");
    expect(screen.getByText("You placed the order")).toBeInTheDocument();
    expect(screen.getByText("Mon 2 Nov")).toBeInTheDocument();
    expect(screen.getByText("You cancelled the order")).toBeInTheDocument();
    expect(screen.getByText("Wed 4 Nov")).toBeInTheDocument();
    expect(screen.getByText("Cancelled")).toBeInTheDocument();
  });

  it("says so when she has no orders", async () => {
    at("/my-orders");
    expect(await screen.findByText("No orders yet")).toBeInTheDocument();
    await waitFor(() => expect(callsTo(market, "market_list_orders")).toHaveLength(1));
  });
});
