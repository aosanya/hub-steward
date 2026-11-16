import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { PaymentsScreen, ProcurementScreen, RevenueBillingScreen, items, routes } from "./index";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

type Args = Record<string, unknown>;

const orders = [
  { id: "o1", picker: "p1", picker_name: "Amara Kole", product: "Stall fee", quantity: 2, unit_price: 150, state: "placed", paid: false, form_id: "f1" },
  { id: "o2", picker: "p2", picker_name: "Dana Reyes", product: "Hall hire", quantity: 1, unit_price: 450, state: "placed", paid: true, form_id: "f1" },
  { id: "o3", picker: "p3", picker_name: "Eli Marsh", product: "Stall fee", quantity: 3, unit_price: 200, state: "placed", paid: false, form_id: "f1" },
];

const submissions = [{ id: "s1", member_id: "p1", member_name: "Amara Kole", sent_at: "2026-03-04T12:00:00Z", answer_count: 1 }];

const asks = [
  { id: "a1", request_id: "n1", question: "Plastic chairs", answer: "waiting" },
  { id: "a2", request_id: "n2", question: "Printer paper", answer: "waiting" },
];

const quotesOf: Record<string, unknown[]> = {
  n1: [],
  n2: [{ id: "q1", notice_id: "n2", price: 900, state: "open" }],
};

const origin = { path: "/a/town/menu/finance", title: "Finance" };

const screens = [
  { title: "Revenue & Billing", at: "/a/town/menu/finance/revenue-and-billing", pattern: "/a/:agencyId/menu/finance/revenue-and-billing", Screen: RevenueBillingScreen, tool: "market_list_orders" },
  { title: "Procurement", at: "/a/town/menu/finance/procurement", pattern: "/a/:agencyId/menu/finance/procurement", Screen: ProcurementScreen, tool: "market_list_asks" },
  { title: "Payments", at: "/a/town/menu/finance/payments", pattern: "/a/:agencyId/menu/finance/payments", Screen: PaymentsScreen, tool: "market_list_orders" },
];

let landed = "";
let called: MockInstance<typeof mcp.callTool>;
let answers: Record<string, (args: Args) => unknown>;

const Where = () => {
  landed = useLocation().pathname;
  return null;
};

beforeEach(() => {
  openAgency("town");
  answers = {
    market_list_orders: () => ({ items: orders }),
    forms_submission_list: () => ({ items: submissions }),
    market_list_asks: () => ({ items: asks }),
    market_list_quotes: (args) => ({ items: quotesOf[String(args.noticeID)] ?? [] }),
    market_mark_paid: (args) => ({ ...orders.find((order) => order.id === args.orderID), paid: true }),
  };
  called = vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => {
    const answer = answers[name];
    if (!answer) throw new Error(`${name} is not a tool this screen may use`);
    return answer((args ?? {}) as Args);
  });
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

const toolsCalled = () => new Set(called.mock.calls.map(([, name]) => name));

const open = (at: string, state: unknown = { from: origin }) =>
  render(
    <MemoryRouter initialEntries={[{ pathname: at, state }]}>
      <Routes>
        {screens.map(({ pattern, Screen }) => (
          <Route key={pattern} path={pattern} element={<Screen />} />
        ))}
        <Route path="*" element={null} />
      </Routes>
      <Where />
    </MemoryRouter>,
  );

const rowOf = (title: string) => screen.getByText(title).closest(".row") as HTMLElement;

const pathOf = (item: { path: unknown }) => (typeof item.path === "function" ? (item.path as () => string)() : String(item.path));

describe("the Finance section's menu", () => {
  it("lists the three built Finance screens under their names, in order", () => {
    expect(items.map((item) => item.title)).toEqual(["Revenue & Billing", "Procurement", "Payments"]);
  });

  it("gives each screen its own path inside the Finance section", () => {
    const paths = items.map(pathOf);

    paths.forEach((path) => expect(path).toMatch(/^\/a\/town\/menu\/finance\/[a-z-]+$/));
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("leaves out Budget and Financial Reports until finance tools exist", () => {
    const titles = items.map((item) => item.title);

    expect(titles).not.toContain("Budget");
    expect(titles).not.toContain("Financial Reports");
  });

  it("exports the routes that serve those screens", () => {
    expect(routes).toBeTruthy();
  });
});

describe("Revenue & Billing", () => {
  it("draws a row for each order with the payer and the amount", async () => {
    open(screens[0].at);

    expect(await screen.findByText("Amara Kole")).toBeInTheDocument();
    expect(screen.getByText("Dana Reyes")).toBeInTheDocument();
    expect(screen.getByText("Eli Marsh")).toBeInTheDocument();
    expect(within(rowOf("Amara Kole")).getByText(/\b300\b/)).toBeInTheDocument();
    expect(within(rowOf("Dana Reyes")).getByText(/\b450\b/)).toBeInTheDocument();
    expect(within(rowOf("Eli Marsh")).getByText(/\b600\b/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Revenue & Billing" })).toBeInTheDocument();
  });

  it("sets the paid mark on an order whose payer sent the paid form", async () => {
    open(screens[0].at);
    await screen.findByText("Amara Kole");

    await waitFor(() => expect(within(rowOf("Amara Kole")).getByText("Paid")).toBeInTheDocument());
    expect(called).toHaveBeenCalledWith("", "forms_submission_list", expect.objectContaining({ form_id: "f1" }));
  });

  it("sets the paid mark on an order the market already holds as paid", async () => {
    open(screens[0].at);
    await screen.findByText("Dana Reyes");

    await waitFor(() => expect(within(rowOf("Dana Reyes")).getByText("Paid")).toBeInTheDocument());
  });

  it("leaves the paid mark off an order nobody has paid", async () => {
    open(screens[0].at);
    await screen.findByText("Eli Marsh");
    await waitFor(() => expect(within(rowOf("Amara Kole")).getByText("Paid")).toBeInTheDocument());

    expect(within(rowOf("Eli Marsh")).queryByText("Paid")).toBeNull();
  });

  it("reads the orders and the paid form, and changes nothing", async () => {
    open(screens[0].at);
    await screen.findByText("Amara Kole");
    await waitFor(() => expect(called).toHaveBeenCalledWith("", "forms_submission_list", expect.anything()));

    expect(toolsCalled()).toEqual(new Set(["market_list_orders", "forms_submission_list"]));
  });
});

describe("Procurement", () => {
  it("draws a row for each request with the item asked for", async () => {
    open(screens[1].at);

    expect(await screen.findByText("Plastic chairs")).toBeInTheDocument();
    expect(screen.getByText("Printer paper")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Procurement" })).toBeInTheDocument();
  });

  it("reads Waiting for quote on a request that has no quotes", async () => {
    open(screens[1].at);
    await screen.findByText("Plastic chairs");

    await waitFor(() => expect(within(rowOf("Plastic chairs")).getByText("Waiting for quote")).toBeInTheDocument());
    expect(within(rowOf("Plastic chairs")).queryByText("Quoted")).toBeNull();
  });

  it("reads Quoted on a request that has quotes", async () => {
    open(screens[1].at);
    await screen.findByText("Printer paper");

    await waitFor(() => expect(within(rowOf("Printer paper")).getByText("Quoted")).toBeInTheDocument());
    expect(within(rowOf("Printer paper")).queryByText("Waiting for quote")).toBeNull();
  });

  it("asks for the quotes of each request by its notice", async () => {
    open(screens[1].at);
    await screen.findByText("Printer paper");

    await waitFor(() => expect(called).toHaveBeenCalledWith("", "market_list_quotes", { noticeID: "n1" }));
    expect(called).toHaveBeenCalledWith("", "market_list_quotes", { noticeID: "n2" });
    expect(toolsCalled()).toEqual(new Set(["market_list_asks", "market_list_quotes"]));
  });
});

describe("Payments", () => {
  it("draws a row for each order with the payer, the amount and whether it is paid", async () => {
    open(screens[2].at);

    expect(await screen.findByText("Amara Kole")).toBeInTheDocument();
    expect(screen.getByText("Dana Reyes")).toBeInTheDocument();
    expect(within(rowOf("Amara Kole")).getByText(/\b300\b/)).toBeInTheDocument();
    expect(within(rowOf("Dana Reyes")).getByText(/\b450\b/)).toBeInTheDocument();
    expect(within(rowOf("Dana Reyes")).getByText("Paid")).toBeInTheDocument();
    expect(within(rowOf("Amara Kole")).queryByText("Paid")).toBeNull();
    expect(screen.getByRole("heading", { name: "Payments" })).toBeInTheDocument();
  });

  it("offers Mark paid on an unpaid order and not on a paid one", async () => {
    open(screens[2].at);
    await screen.findByText("Amara Kole");

    expect(within(rowOf("Amara Kole")).getByRole("button", { name: "Mark paid" })).toBeInTheDocument();
    expect(within(rowOf("Dana Reyes")).queryByRole("button", { name: "Mark paid" })).toBeNull();
  });

  it("calls market_mark_paid for the order whose button was pressed", async () => {
    open(screens[2].at);
    await screen.findByText("Eli Marsh");

    await userEvent.click(within(rowOf("Eli Marsh")).getByRole("button", { name: "Mark paid" }));

    await waitFor(() => expect(called).toHaveBeenCalledWith("", "market_mark_paid", { orderID: "o3" }));
    expect(called.mock.calls.filter(([, name]) => name === "market_mark_paid")).toHaveLength(1);
  });

  it("shows the order as paid once Mark paid went through", async () => {
    open(screens[2].at);
    await screen.findByText("Eli Marsh");

    await userEvent.click(within(rowOf("Eli Marsh")).getByRole("button", { name: "Mark paid" }));

    await waitFor(() => expect(within(rowOf("Eli Marsh")).getByText("Paid")).toBeInTheDocument());
    expect(within(rowOf("Eli Marsh")).queryByRole("button", { name: "Mark paid" })).toBeNull();
  });

  it("says so when Mark paid did not go through, and keeps the order unpaid", async () => {
    answers.market_mark_paid = () => {
      throw new Error("refused");
    };
    open(screens[2].at);
    await screen.findByText("Eli Marsh");

    await userEvent.click(within(rowOf("Eli Marsh")).getByRole("button", { name: "Mark paid" }));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(within(rowOf("Eli Marsh")).queryByText("Paid")).toBeNull();
  });
});

describe.each(screens)("$title as a screen of the Finance section", ({ title, at, tool }) => {
  it("has a Back button that reads Finance and goes there", async () => {
    open(at);
    await waitFor(() => expect(called).toHaveBeenCalled());

    await userEvent.click(await screen.findByRole("button", { name: /Finance/ }));

    await waitFor(() => expect(landed).toBe(origin.path));
  });

  it("reads another origin's name when the person came from somewhere else", async () => {
    open(at, { from: { path: "/a/town/menu/services", title: "Services & Permits" } });
    await waitFor(() => expect(called).toHaveBeenCalled());

    expect(await screen.findByRole("button", { name: /Services & Permits/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Finance/ })).toBeNull();
  });

  it("shows the empty state as a card with its act inside it when nothing came back", async () => {
    answers[tool] = () => ({ items: [] });
    open(at);

    await waitFor(() => expect(document.querySelector(".card button")).not.toBeNull());
    const card = (document.querySelector(".card button") as HTMLElement).closest(".card") as HTMLElement;
    expect(within(card).getAllByRole("button")).not.toHaveLength(0);
    expect(card.querySelector("p")?.textContent).not.toBe("");
    expect(card.querySelector("svg, img")).toBeNull();
    expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
  });
});

describe.each(screens)("$title bottom tab bar", ({ at }) => {
  it("draws the main tab bar like every other section screen", async () => {
    open(at);
    await waitFor(() => expect(called).toHaveBeenCalled());

    const bar = screen.getByRole("navigation", { name: "Main" });
    expect(within(bar).getByRole("link", { name: /Home/ })).toBeInTheDocument();
  });
});
