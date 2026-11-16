import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { PaymentListScreen } from "./PaymentListScreen";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

type Args = Record<string, unknown> | undefined;

const openBill = { id: "b1", payer: "Anna Sample", amount: 1500, settled: 300, outstanding: 1200, due_at: "2026-12-01T00:00:00Z", status: "open" };
const lateBill = { id: "b2", payer: "Csilla Sample", amount: 800, settled: 0, outstanding: 800, due_at: "2026-10-01T00:00:00Z", status: "overdue" };
const earlierPayment = { id: "p1", kind: "bill", amount: 450, paid_at: "2026-11-02T09:00:00Z", paid_by: "u1", bill_id: "b0", payer: "Ben Sample" };

const accounts = [
  { id: "a1", code: "1000", name: "Receivables", category: "receivable", type: "asset" },
  { id: "a2", code: "1100", name: "Cash at bank", category: "cash", type: "asset" },
];

const origin = { path: "/a/town/menu/finance", title: "Finance" };

let called: MockInstance<typeof mcp.callTool>;
let marked: boolean;
let refuse: boolean;
let chart: unknown[];

const callsTo = (name: string) => called.mock.calls.filter(([, tool]) => tool === name);

const pane = () => document.querySelector(".mw-detail") as HTMLElement;

const rowOf = async (payer: string) => (await screen.findByRole("button", { name: new RegExp(payer) })) as HTMLElement;

const openScreen = () =>
  render(
    <MemoryRouter initialEntries={[{ pathname: "/a/town/menu/finance/payments", state: { from: origin } }]}>
      <Routes>
        <Route path="/a/:agencyId/menu/finance/payments" element={<PaymentListScreen />} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  openAgency("town");
  marked = false;
  refuse = false;
  chart = accounts;
  called = vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => {
    const given = (args ?? {}) as NonNullable<Args>;
    if (name === "accounting_bill_list") {
      if (given.status === "open") return { items: marked ? [] : [openBill] };
      if (given.status === "overdue") return { items: [lateBill] };
      return { items: [] };
    }
    if (name === "accounting_payment_list") {
      return { items: marked ? [earlierPayment, { id: "p2", kind: "bill", amount: 1200, paid_at: "2026-11-16T10:00:00Z", paid_by: "u1", bill_id: "b1", payer: "Anna Sample" }] : [earlierPayment] };
    }
    if (name === "accounting_account_list") return { items: chart };
    if (name === "accounting_payment_mark_paid") {
      if (refuse) throw new Error("refused");
      marked = true;
      return { id: "p2" };
    }
    throw new Error(`${name} is not a tool this screen may use`);
  });
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

describe("PaymentListScreen", () => {
  it("lists the bills still owed under To pay with the amount outstanding and due day", async () => {
    openScreen();

    expect(await screen.findByRole("heading", { name: "To pay" })).toBeInTheDocument();
    const anna = await rowOf("Anna Sample");
    expect(within(anna).getByText("1,200 · due 2026-12-01")).toBeInTheDocument();
    expect(within(anna).getByText("Unpaid")).toBeInTheDocument();
    expect(within(await rowOf("Csilla Sample")).getByText("Overdue")).toBeInTheDocument();
  });

  it("asks for open and overdue bills separately and merges them", async () => {
    openScreen();
    await rowOf("Anna Sample");

    expect(callsTo("accounting_bill_list").map(([, , args]) => (args as { status: string }).status).sort()).toEqual(["open", "overdue"]);
  });

  it("lists the payments made under Paid with the amount and the day paid", async () => {
    openScreen();

    expect(await screen.findByRole("heading", { name: "Paid" })).toBeInTheDocument();
    const ben = await rowOf("Ben Sample");
    expect(within(ben).getByText("450 · 2026-11-02")).toBeInTheDocument();
    expect(within(ben).getByText("Paid")).toBeInTheDocument();
  });

  it("opens an owed bill with payer, outstanding and due, and offers Mark paid", async () => {
    openScreen();
    await userEvent.click(await rowOf("Anna Sample"));

    expect(await screen.findByRole("button", { name: "Mark paid" })).toBeInTheDocument();
    expect(pane().textContent).toContain("Outstanding");
    expect(pane().textContent).toContain("1,200");
    expect(pane().textContent).toContain("2026-12-01");
  });

  it("opens a payment with payer, amount and paid on, without Mark paid", async () => {
    openScreen();
    await userEvent.click(await rowOf("Ben Sample"));

    await waitFor(() => expect(pane().textContent).toContain("Paid on"));
    expect(pane().textContent).toContain("2026-11-02");
    expect(pane().textContent).toContain("450");
    expect(screen.queryByRole("button", { name: "Mark paid" })).toBeNull();
  });

  it("marks the bill paid against the cash account and then lists it under Paid", async () => {
    openScreen();
    await userEvent.click(await rowOf("Anna Sample"));
    await userEvent.click(await screen.findByRole("button", { name: "Mark paid" }));

    await waitFor(() => expect(callsTo("accounting_payment_mark_paid")).toHaveLength(1));
    expect(callsTo("accounting_payment_mark_paid")[0]).toEqual(["", "accounting_payment_mark_paid", { billID: "b1", cash_account_id: "a2" }]);
    await waitFor(() => expect(within(screen.getByRole("button", { name: /Anna Sample/ })).getByText("Paid")).toBeInTheDocument());
    expect(screen.queryByText("Unpaid")).toBeNull();
  });

  it("says it did not go through when the agency has no cash account", async () => {
    chart = [accounts[0]];
    openScreen();
    await userEvent.click(await rowOf("Anna Sample"));
    await userEvent.click(await screen.findByRole("button", { name: "Mark paid" }));

    expect(await screen.findByText(/did not go through/i)).toBeInTheDocument();
    expect(callsTo("accounting_payment_mark_paid")).toHaveLength(0);
    expect(within(await rowOf("Anna Sample")).getByText("Unpaid")).toBeInTheDocument();
  });

  it("says it did not go through and keeps the bill owed when marking is refused", async () => {
    refuse = true;
    openScreen();
    await userEvent.click(await rowOf("Anna Sample"));
    await userEvent.click(await screen.findByRole("button", { name: "Mark paid" }));

    expect(await screen.findByText(/did not go through/i)).toBeInTheDocument();
    expect(within(await rowOf("Anna Sample")).getByText("Unpaid")).toBeInTheDocument();
  });

  it("says so when nothing is owed and nothing was paid", async () => {
    called.mockImplementation(async () => ({ items: [] }));
    openScreen();

    expect(await screen.findByText("No payments yet.")).toBeInTheDocument();
  });
});
