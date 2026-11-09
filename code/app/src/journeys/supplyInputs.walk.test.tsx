import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { App } from "../App";
import * as mcp from "../wakala/mcp";
import { forgetSubject } from "../wakala/me";
import { openAgency } from "../agency/open";
import { agenciesFrom, answerWakala } from "./answerWakala";
import { farmerChatSteps } from "./chatSteps";

beforeEach(() => openAgency("walk-agency"));

type Row = Record<string, any>;

const member = "m1";

const farmers = [
  ["Grace Adhiambo", 3],
  ["Asha Otieno", 2],
  ["Auma Oluoch", 2],
  ["Baraka Njeri", 2],
  ["Wanjiru Kamau", 2],
  ["Otieno Odhiambo", 2],
  ["Atieno Owino", 2],
  ["Juma Mwangi", 1],
] as const;

const startingTerms = [{ version: 1, price: 3600, minimum: 20 }];

const joinGroupStep = {
  id: "w3",
  title: "Join a group",
  form_name: "Join a group",
  role_name: "Farmer",
  kind: "fill_form",
  questions: [{ prompt: "Group code", answer_type: "free_text", required: false }],
};

const applyAsSupplierStep = {
  id: "w4",
  title: "Apply as a supplier",
  form_name: "Apply as a supplier",
  role_name: "Farmer",
  kind: "fill_form",
  questions: [
    { prompt: "Shop name", answer_type: "free_text", required: true },
    { prompt: "Area", answer_type: "free_text" },
    { prompt: "What you sell", answer_type: "free_text" },
  ],
};

const world = () => {
  const store = {
    suppliers: [] as Row[],
    steps: [...farmerChatSteps, joinGroupStep, applyAsSupplierStep] as Row[],
    offers: [] as Row[],
    stock: [] as Row[],
    notifications: [] as Row[],
    asks: [
      {
        id: "a1",
        poster_id: "p1",
        picker: "m-asha",
        picker_name: "Asha Otieno",
        question: "2 bags of Urea 50kg",
        detail: "Needed by Friday. KES 7,600 at KES 3,800 a bag.",
        answer: "waiting",
      },
      {
        id: "a2",
        poster_id: "p1",
        picker: "m-asha",
        picker_name: "Asha Otieno",
        question: "Hybrid maize seed 614, 10 kg",
        detail: "Needed by Friday.",
        answer: "waiting",
      },
    ] as Row[],
    yeses: [
      {
        id: "y0",
        ask_id: "a0",
        poster_id: "p1",
        picker: "m-wanjiru",
        picker_name: "Wanjiru Kamau",
        what: "Urea 50kg",
        quantity: 2,
        date: "2026-11-07",
        note: "",
        state: "open",
      },
    ] as Row[],
    orders: [
      {
        id: "or1",
        picker_name: "Auma Oluoch",
        yes_id: "y-old1",
        promised_date: "2026-11-05",
        poster_id: "p1",
        product: "Urea 50kg",
        quantity: 2,
        unit_price: 3800,
        state: "open",
        paid: false,
        created_at: "2026-11-05T08:00:00Z",
      },
      {
        id: "or2",
        picker_name: "Baraka Njeri",
        yes_id: "y-old2",
        promised_date: "2026-11-06",
        poster_id: "p1",
        product: "Urea 50kg",
        quantity: 2,
        unit_price: 3800,
        state: "open",
        paid: false,
        created_at: "2026-11-06T08:00:00Z",
      },
    ] as Row[],
    groupOrder: {
      id: "g1",
      poster_id: "p1",
      product: "Urea 50kg",
      coordinator: "m-grace",
      price: 3600,
      minimum: 20,
      terms_version: 1,
      terms_history: JSON.stringify(startingTerms),
      state: "open",
      total: 16,
      count: 8,
      lines: farmers.map(([name, quantity], i) => ({ id: `l${i}`, picker_name: name, quantity, answer: "" })),
    } as Row,
    calls: [] as { tool: string; args: Record<string, unknown> }[],
  };

  const mine = () => store.suppliers[0];
  let nextOffer = 1;

  const handlers: Record<string, (args: Row) => unknown> = {
    agency_list_my_open_steps: () => ({ items: store.steps }),
    market_list_posters: () => ({ items: store.suppliers }),
    market_apply_poster: (args) => {
      const row = {
        id: "p1",
        name: args.name,
        area: args.area,
        posts: args.posts,
        owner: member,
        status: "pending",
        approved_by: "",
        owner_name: "Kisumu supplier",
        approved_by_name: "",
      };
      store.suppliers.push(row);
      return row;
    },
    market_list_offers: (args) => ({ items: store.offers.filter((o) => args.poster_id === undefined || o.poster_id === args.poster_id) }),
    market_create_offer: (args) => {
      const row: Row = { ...args, id: `o${nextOffer++}` };
      store.offers.push(row);
      return row;
    },
    market_update_offer: (args) => {
      const at = store.offers.findIndex((o) => o.id === args.offerID);
      const { offerID: _held, ...body } = args;
      store.offers[at] = { ...store.offers[at], ...body };
      return store.offers[at];
    },
    market_get_stock: () => ({ items: store.stock }),
    market_set_stock: (args) => {
      const at = store.stock.findIndex((s) => s.product === args.product);
      const row = { product: args.product, count: args.count };
      if (at >= 0) store.stock[at] = row;
      else store.stock.push(row);
      return row;
    },
    market_list_asks: () => ({ items: store.asks }),
    market_answer_ask: (args) => {
      const ask = store.asks.find((a) => a.id === args.askID)!;
      ask.answer = args.answer;
      if (args.answer === "yes") {
        store.yeses.push({
          id: "y1",
          ask_id: ask.id,
          poster_id: "p1",
          picker: ask.picker,
          picker_name: ask.picker_name,
          what: "Urea 50kg",
          quantity: 2,
          date: args.date,
          note: args.note ?? "",
          state: "open",
        });
      }
      return ask;
    },
    market_list_yeses: () => ({ items: store.yeses }),
    market_list_orders: () => ({ items: store.orders }),
    market_get_order: (args) => store.orders.find((o) => o.id === args.orderID),
    market_mark_paid: (args) => {
      const order = store.orders.find((o) => o.id === args.orderID)!;
      order.paid = true;
      order.state = "paid";
      return order;
    },
    market_list_group_orders: () => ({ items: [store.groupOrder] }),
    market_get_group_order: () => store.groupOrder,
    market_ask_revision: (args) => {
      const order = store.groupOrder;
      order.price = args.price;
      order.minimum = args.minimum;
      order.terms_version = 2;
      order.terms_history = JSON.stringify([...startingTerms, { version: 2, price: args.price, minimum: args.minimum }]);
      order.state = "revising";
      order.lines = order.lines.map((l: Row) => ({ ...l, answer: "waiting" }));
      return order;
    },
    comm_notification_list: () => ({ items: store.notifications }),
    comm_notification_mark_read: (args) => {
      store.notifications.forEach((n) => (n.read_at = "2026-11-02T09:00:00Z"));
      return { marked: (args.ids as string[]).length };
    },
    actor_list_my_invitations: () => ({ items: [] }),
    actor_list_actors: () => ({ items: [{ id: "m-grace", display_name: "Grace Adhiambo" }] }),
  };

  const approve = () => {
    mine().status = "approved";
    mine().approved_by = "m-grace";
    mine().approved_by_name = "Grace Adhiambo";
    store.notifications.push({
      id: "n1",
      event: "supplier_approved",
      subject_kind: "poster",
      subject_id: "p1",
      names: { group: "Siaya Farmers' Group", person: "Grace Adhiambo" },
      created_at: "2026-11-02T08:00:00Z",
      read_at: null,
    });
  };

  const farmersAnswer = () => {
    const answers = ["yes", "yes", "yes", "no", "no", "waiting", "waiting", "waiting"];
    store.groupOrder.lines = store.groupOrder.lines.map((l: Row, i: number) => ({ ...l, answer: answers[i] }));
  };

  const call = async (_hub: string, tool: string, args: Row = {}) => {
    store.calls.push({ tool, args });
    const handler = handlers[tool];
    if (!handler) throw new Error(`no fake for ${tool}`);
    return structuredClone(handler(args));
  };

  const called = (tool: string) => store.calls.filter((c) => c.tool === tool).map((c) => c.args);

  return { store, approve, farmersAnswer, call, called };
};

const walk = world();

const open = async () => {
  render(
    <MemoryRouter initialEntries={["/"]}>
      <App />
    </MemoryRouter>,
  );
  await userEvent.click(await screen.findByRole("link", { name: /Do Something/ }));
};

const press = (name: string | RegExp) => userEvent.click(screen.getByRole("button", { name }));

const pressWhenShown = async (name: string | RegExp) => userEvent.click(await screen.findByRole("button", { name }));

const openStartRow = async (name: string | RegExp) => userEvent.click(await screen.findByRole("button", { name }));

const goBack = () => userEvent.click(screen.getByRole("button", { name: "Back" }));

const goTab = (name: RegExp) => userEvent.click(screen.getByRole("link", { name }));

const fill = async (label: string, value: string) => {
  const field = screen.getByLabelText(label);
  await userEvent.clear(field);
  await userEvent.type(field, value);
};

const fillForm = async (values: Record<string, string>) => {
  for (const [label, value] of Object.entries(values)) await fill(label, value);
};

const heading = (name: string) => screen.findByRole("heading", { name, level: 1 });

describe("journey 14, supply inputs", () => {
  beforeAll(() => {
    forgetSubject();
    vi.stubGlobal("fetch", answerWakala(() => member, agenciesFrom(walk.call as any)));
    vi.spyOn(mcp, "callTool").mockImplementation(walk.call as any);
  });

  afterAll(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    forgetSubject();
  });

  it("step 1: applies as a supplier, waits, and is approved", async () => {
    await open();
    await openStartRow(/^Apply as a supplier/);
    await heading("Apply as a supplier");
    await fillForm({ "Shop name": "Kisumu Agro Supplies", Area: "Kisumu", "What you sell": "Fertiliser and seed" });
    await press("Send application");

    await heading("Your application");
    expect(await screen.findByText("Kisumu Agro Supplies")).toBeInTheDocument();
    expect(screen.getByText("Kisumu · Fertiliser and seed")).toBeInTheDocument();
    expect(screen.getByText("Asked")).toBeInTheDocument();
    expect(screen.getByText("Waiting on the group coordinator")).toBeInTheDocument();
    expect(screen.getByText("Waiting")).toBeInTheDocument();
    expect(walk.called("market_apply_poster")).toEqual([
      { name: "Kisumu Agro Supplies", area: "Kisumu", posts: "Fertiliser and seed" },
    ]);
    expect(screen.queryByRole("button", { name: /^Offers/ })).toBeNull();

    await goBack();
    await heading("Do Something");
    expect(await screen.findByRole("button", { name: /^Sell harvest/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Orders/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Asks/ })).toBeNull();

    walk.approve();

    await goTab(/Home/);
    await goTab(/Home/);
    await heading("Home");
    expect(await screen.findByText("You are approved as a supplier")).toBeInTheDocument();
    expect(screen.getByText("Grace Adhiambo · Siaya Farmers' Group")).toBeInTheDocument();
    await press("Mark all read");
    await waitFor(() => expect(screen.queryByRole("button", { name: "Mark all read" })).toBeNull());

    await goTab(/Do Something/);
    for (const row of [/^Offers/, /^Asks/, /^Group order/, /^Orders/]) {
      expect(await screen.findByRole("button", { name: row })).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: /^Forms/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Join a group/ })).toBeInTheDocument();

    await press("Menu");
    for (const item of [/^My profile/, /^Switch agency/, /^Change language/, /^Sign out/]) {
      expect(await screen.findByRole("menuitem", { name: item })).toBeInTheDocument();
    }
  });

  it("step 2: posts prices, opens a row to change it, and keeps a private stock list", async () => {
    await open();
    await openStartRow(/^Offers/);
    await heading("Offers");
    expect(await screen.findByText("No offers yet")).toBeInTheDocument();

    await press("Add an offer");
    await heading("Add an offer");
    await fillForm({
      "Product, in your words": "Urea 50kg",
      Unit: "bag",
      "Price (KES)": "3800",
      "Bulk from": "20",
      "Bulk price (KES)": "3600",
    });
    await press("Save offer");

    await heading("Offers");
    expect(await screen.findByText("Offers · 1")).toBeInTheDocument();
    await press("Add an offer");
    await fillForm({ "Product, in your words": "DAP 50kg", Unit: "bag", "Price (KES)": "4500" });
    await press("Save offer");

    expect(await screen.findByText("Offers · 2")).toBeInTheDocument();
    expect(screen.getByText("KES 3,800 a bag · 20 or more KES 3,600")).toBeInTheDocument();
    expect(screen.getByText("KES 4,500 a bag")).toBeInTheDocument();
    expect(walk.called("market_create_offer")).toHaveLength(2);

    await press(/DAP 50kg/);
    await heading("Edit offer");
    expect(screen.getByLabelText("Product, in your words")).toHaveValue("DAP 50kg");
    expect(screen.getByLabelText("Price (KES)")).toHaveValue("4500");
    await press("Save offer");
    expect(await screen.findByText("Offers · 2")).toBeInTheDocument();
    expect(walk.called("market_update_offer")).toHaveLength(1);

    await press("Stock list");
    await heading("Stock list");
    expect(await screen.findByText("Only you see this list")).toBeInTheDocument();
    await fill("Urea 50kg (bags)", "40");
    await fill("DAP 50kg (bags)", "25");
    await press("Save list");
    expect(await screen.findByText("List saved")).toBeInTheDocument();
    expect(walk.called("market_set_stock").map((a) => [a.product, a.count])).toEqual([
      ["Urea 50kg", 40],
      ["DAP 50kg", 25],
    ]);

    await goBack();
    await heading("Offers");
    expect(await screen.findByText("Offers · 2")).toBeInTheDocument();
  });

  it("step 3: opens the asks waiting, answers one Yes with a date and a note and another No", async () => {
    await open();
    await openStartRow(/^Asks/);
    await heading("Asks");
    expect(await screen.findByRole("button", { name: /2 bags of Urea 50kg/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Hybrid maize seed 614/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Waiting · 2" })).toHaveAttribute("aria-pressed", "true");

    await press(/2 bags of Urea 50kg/);
    await heading("Ask");
    expect(await screen.findByText("Asha Otieno")).toBeInTheDocument();
    expect(screen.getByText("Needed by Friday. KES 7,600 at KES 3,800 a bag.")).toBeInTheDocument();
    expect(await screen.findByText(/^Your list: 40 bags\. Already promised: 2 bags$/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Only you see this" })).toBeInTheDocument();

    await press("Yes");
    expect(screen.getByRole("heading", { name: "Yes to Asha Otieno" })).toBeInTheDocument();
    await fillForm({ Date: "2026-11-06", Note: "Collect at the shop" });
    await press("Send yes");
    expect(await screen.findByRole("heading", { name: "Your answer" })).toBeInTheDocument();
    expect(screen.getByText("Friday, 6 Nov")).toBeInTheDocument();
    expect(screen.getByText("Collect at the shop")).toBeInTheDocument();
    expect(walk.called("market_answer_ask")).toEqual([
      { askID: "a1", answer: "yes", date: "2026-11-06", note: "Collect at the shop" },
    ]);

    await goBack();
    await heading("Asks");
    expect(await screen.findByRole("button", { name: /Hybrid maize seed 614/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /2 bags of Urea 50kg/ })).toBeNull();

    await press(/Hybrid maize seed 614/);
    await press("No");
    expect(await screen.findByRole("heading", { name: "Your answer" })).toBeInTheDocument();
    expect(walk.called("market_answer_ask")[1]).toEqual({ askID: "a2", answer: "no" });

    await goBack();
    await heading("Asks");
    expect(await screen.findByText("No asks are waiting.")).toBeInTheDocument();
    await press("Answered");
    expect(screen.getByRole("button", { name: /2 bags of Urea 50kg/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Hybrid maize seed 614/ })).toBeInTheDocument();
  });

  it("step 4: sees the open group order and asks the farmers to revise", async () => {
    await open();
    await openStartRow(/^Group order/);
    await heading("Group orders");
    await pressWhenShown(/KES 3,600 a bag from 20 bags/);

    await heading("Group order");
    expect(await screen.findByText("KES 3,600 a bag from 20 bags")).toBeInTheDocument();
    expect(screen.getByText("16 of 20 bags")).toBeInTheDocument();
    expect(screen.getByText("8 farmers · started by Grace Adhiambo")).toBeInTheDocument();
    for (const [name] of farmers) expect(screen.getByText(name)).toBeInTheDocument();
    expect(screen.queryByText(/\+?254|@/)).toBeNull();

    await press("Ask the farmers to revise");
    await heading("Ask the farmers to revise");
    expect(await screen.findByLabelText("Price a bag (KES)")).toHaveValue("3600");
    await fillForm({ "Price a bag (KES)": "3700", "Minimum bags": "20" });
    await press("Ask the farmers");

    await heading("Group order");
    expect(await screen.findByText("Started with")).toBeInTheDocument();
    expect(screen.getByText("KES 3,700 a bag from 20 bags")).toBeInTheDocument();
    expect(screen.getByText("KES 3,600 a bag from 20 bags")).toBeInTheDocument();
    expect(walk.called("market_ask_revision")).toEqual([{ groupOrderID: "g1", price: 3700, minimum: 20 }]);
    expect(screen.getByText("0 yes · 0 no · 8 waiting")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ask the farmers to revise" })).toBeNull();

    walk.farmersAnswer();

    await goBack();
    await heading("Group orders");
    await pressWhenShown(/KES 3,700 a bag from 20 bags/);
    expect(await screen.findByText("3 yes · 2 no · 3 waiting")).toBeInTheDocument();
    expect(screen.getAllByText("Yes")).toHaveLength(3);
    expect(screen.getAllByText("No")).toHaveLength(2);
    expect(screen.getAllByText("Waiting")).toHaveLength(3);
  });

  it("step 5: lists the open yeses and orders, marks one order paid", async () => {
    await open();
    await openStartRow(/^Orders/);
    await heading("Orders");
    expect(await screen.findByRole("button", { name: "Open · 4" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Paid · 0" })).toBeInTheDocument();
    expect(screen.getByText("Yeses · 2")).toBeInTheDocument();
    expect(screen.getByText("Orders · 2")).toBeInTheDocument();
    const yeses = within(screen.getByText("Yeses · 2").nextElementSibling as HTMLElement);
    expect(yeses.getByText("Asha Otieno")).toBeInTheDocument();
    expect(yeses.getByText("Collect at the shop")).toBeInTheDocument();
    expect(yeses.getByText("Wanjiru Kamau")).toBeInTheDocument();
    expect(screen.getByText("Baraka Njeri")).toBeInTheDocument();

    await press(/Auma Oluoch/);
    expect(await screen.findByRole("heading", { name: "Auma Oluoch", level: 1 })).toBeInTheDocument();
    expect(await screen.findByText("2 of Urea 50kg")).toBeInTheDocument();
    expect(screen.getByText("KES 3,800 each · KES 7,600 in all")).toBeInTheDocument();
    expect(screen.getByText("Open")).toBeInTheDocument();
    expect(screen.getByText("Thursday, 5 Nov", { selector: ".meta" })).toBeInTheDocument();

    await press("Mark paid");
    expect(await screen.findByText("Paid")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mark paid" })).toBeNull();
    expect(walk.called("market_mark_paid")).toEqual([{ orderID: "or1" }]);

    await goBack();
    await heading("Orders");
    expect(await screen.findByRole("button", { name: "Open · 3" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Paid · 1" })).toBeInTheDocument();
    await press("Paid · 1");
    expect(screen.getByText("Auma Oluoch")).toBeInTheDocument();
    expect(screen.queryByText("Baraka Njeri")).toBeNull();
  });
});
