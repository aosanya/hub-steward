import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { BillsScreen } from "./BillsScreen";

type Args = Record<string, unknown> | undefined;

type Answers = Record<string, (args: Args) => unknown>;

const origin = { path: "/a/town/menu/finance", title: "Finance" };

let landed = "";
let called: MockInstance<typeof mcp.callTool>;

const Where = () => {
  landed = useLocation().pathname;
  return null;
};

const answering = (answers: Answers) =>
  vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => (answers[name] ? answers[name](args as Args) : { items: [] }));

const callsTo = (name: string) => called.mock.calls.filter(([, tool]) => tool === name);

const pane = () => document.querySelector(".mw-detail") as HTMLElement;

const backButton = (name: RegExp) => screen.getByRole("button", { name });

const rowOf = (payer: RegExp) => screen.getByRole("button", { name: payer });

const open = () =>
  render(
    <MemoryRouter initialEntries={[{ pathname: "/a/town/menu/finance/revenue-and-billing", state: { from: origin } }]}>
      <Routes>
        <Route path="/a/:agencyId/menu/finance/revenue-and-billing" element={<BillsScreen />} />
        <Route path="*" element={null} />
      </Routes>
      <Where />
    </MemoryRouter>,
  );

beforeEach(() => openAgency("town"));

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

const bills = [
  { id: "b1", payer: "Sample Bakery", amount: 900, settled: 900, outstanding: 0, due_at: "2026-03-01T00:00:00Z", status: "settled", days_overdue: 0 },
  { id: "b2", payer: "Sample Garage", amount: 1500, settled: 500, outstanding: 1000, due_at: "2026-01-15T00:00:00Z", status: "overdue", days_overdue: 40 },
  { id: "b3", payer: "Sample Market", amount: 250, settled: 0, outstanding: 250, due_at: "2026-04-10T00:00:00Z", status: "open", days_overdue: 0 },
  { id: "b4", payer: "Sample School", amount: 400, settled: 0, outstanding: 0, due_at: "2026-02-02T00:00:00Z", status: "reversed", days_overdue: 0 },
];

const accounts = [
  { id: "a-inc", code: "4000", name: "Market fees", category: "market_fees", type: "income" },
  { id: "a-rec", code: "1200", name: "Receivables", category: "receivable", type: "asset" },
  { id: "a-cash", code: "1000", name: "Cash", category: "cash", type: "asset" },
];

const payments = [
  { id: "p1", kind: "bill", amount: 300, paid_at: "2026-01-20T00:00:00Z", narration: "First part", bill_id: "b2", payer: "Sample Garage" },
  { id: "p2", kind: "bill", amount: 200, paid_at: "2026-02-10T00:00:00Z", narration: "Second part", bill_id: "b2", payer: "Sample Garage" },
];

const answers: Answers = {
  accounting_bill_list: (args) => ({ items: bills.filter((bill) => !args?.status || bill.status === args.status) }),
  accounting_bill_read: (args) => ({ ...bills.find((bill) => bill.id === args?.billID), narration: "March stall fee" }),
  accounting_payment_list: (args) => ({ items: payments.filter((payment) => payment.bill_id === args?.bill_id) }),
  accounting_account_list: () => ({ items: accounts }),
  agency_get_my_roles: () => ({ permissions: ["accounting.manage"] }),
};

const withoutManage: Answers = { ...answers, agency_get_my_roles: () => ({ permissions: ["accounting.view"] }) };

const screens = (replies: Answers = answers) => {
  called = answering(replies);
  return open();
};

describe("the bills list", () => {
  it("draws one row for each bill the hub lists, named by payer, with the amount and due date", async () => {
    screens();

    expect(await screen.findByText("Sample Bakery")).toBeInTheDocument();
    expect(screen.getByText("Sample Garage")).toBeInTheDocument();
    expect(screen.getByText("900 · due 2026-03-01")).toBeInTheDocument();
    expect(screen.getByText("1,500 · due 2026-01-15")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Revenue & Billing" })).toBeInTheDocument();
    expect(callsTo("accounting_bill_list")).toHaveLength(1);
  });

  it("reads Settled on a settled bill and Overdue on an overdue one", async () => {
    screens();
    await screen.findByText("Sample Bakery");

    expect(within(rowOf(/Sample Bakery/)).getByText("Settled")).toBeInTheDocument();
    expect(within(rowOf(/Sample Garage/)).getByText("Overdue")).toBeInTheDocument();
  });

  it("reads Open on an open bill and Reversed on a reversed one", async () => {
    screens();
    await screen.findByText("Sample Market");

    expect(within(rowOf(/Sample Market/)).getByText("Open")).toBeInTheDocument();
    expect(within(rowOf(/Sample School/)).getByText("Reversed")).toBeInTheDocument();
  });

  it("filters the rows already loaded as the person types", async () => {
    screens();
    await screen.findByText("Sample Bakery");

    await userEvent.type(screen.getByRole("searchbox"), "garage");

    expect(screen.getByText("Sample Garage")).toBeInTheDocument();
    expect(screen.queryByText("Sample Bakery")).toBeNull();
    expect(callsTo("accounting_bill_list")).toHaveLength(1);
  });

  it("says so when the hub lists no bills", async () => {
    screens({ ...answers, accounting_bill_list: () => ({ items: [] }) });

    expect(await screen.findByText(/No bills/i)).toBeInTheDocument();
  });
});

describe("a bill", () => {
  it("opens beside the list when a row is pressed, asking accounting_bill_read with the billID", async () => {
    screens();
    await userEvent.click(await screen.findByRole("button", { name: /Sample Garage/ }));

    await waitFor(() => expect(pane()).not.toBeNull());
    await waitFor(() => expect(callsTo("accounting_bill_read")).toHaveLength(1));
    expect(callsTo("accounting_bill_read")[0][2]).toEqual({ billID: "b2" });
  });

  it("shows Payer, Amount, Settled, Outstanding, Due and Status for the bill", async () => {
    screens();
    await userEvent.click(await screen.findByRole("button", { name: /Sample Garage/ }));
    await waitFor(() => expect(pane().textContent).toContain("Sample Garage"));

    const detail = within(pane());
    ["Payer", "Amount", "Settled", "Outstanding", "Due", "Status"].forEach((label) => expect(detail.getByText(label)).toBeInTheDocument());
    expect(detail.getByText("1,500")).toBeInTheDocument();
    expect(detail.getByText("500")).toBeInTheDocument();
    expect(detail.getByText("1,000")).toBeInTheDocument();
    expect(detail.getByText("2026-01-15")).toBeInTheDocument();
    expect(detail.getByText("Overdue")).toBeInTheDocument();
  });

  it("reads Settled as the status of a settled bill in its detail, beside the Settled label", async () => {
    screens();
    await userEvent.click(await screen.findByRole("button", { name: /Sample Bakery/ }));
    await waitFor(() => expect(pane().textContent).toContain("Sample Bakery"));

    expect(within(pane()).getAllByText("Settled")).toHaveLength(2);
  });

  it("goes from an opened bill back to the list, and Back names Revenue & Billing", async () => {
    screens();
    await userEvent.click(await screen.findByRole("button", { name: /Sample Garage/ }));
    await waitFor(() => expect(pane()).not.toBeNull());

    await userEvent.click(backButton(/‹ Revenue & Billing$/));

    expect(document.querySelector(".mw-detail")).toBeNull();
    expect(screen.getByText("Sample Bakery")).toBeInTheDocument();
  });

  it("names Finance on Back from the list, and goes there", async () => {
    screens();
    await screen.findByText("Sample Bakery");

    await userEvent.click(backButton(/Finance/));

    await waitFor(() => expect(landed).toBe(origin.path));
  });
});

describe("raising a bill", () => {
  it("offers Raise bill to a caller who holds accounting.manage", async () => {
    screens();
    await screen.findByText("Sample Bakery");

    expect(await screen.findByRole("button", { name: "Raise bill" })).toBeInTheDocument();
  });

  it("shows no Raise bill button to a caller without accounting.manage", async () => {
    screens(withoutManage);
    await screen.findByText("Sample Bakery");

    await waitFor(() => expect(callsTo("agency_get_my_roles")).toHaveLength(1));
    expect(screen.queryByRole("button", { name: "Raise bill" })).toBeNull();
  });

  it("raises a bill on accounting_bill_create with both accounts, amount, due date, payer and narration, and lists it Open", async () => {
    const raised: Record<string, unknown>[] = [];
    screens({
      ...answers,
      accounting_bill_list: () => ({ items: [...bills, ...raised] }),
      accounting_bill_create: (args) => {
        raised.push({ id: "b9", payer: args?.payer, amount: args?.amount, settled: 0, outstanding: args?.amount, due_at: args?.due_at, status: "open", days_overdue: 0 });
        return raised[0];
      },
    });
    await userEvent.click(await screen.findByRole("button", { name: "Raise bill" }));
    const form = within(await screen.findByRole("dialog"));

    await userEvent.selectOptions(form.getByLabelText("Income account"), "a-inc");
    await userEvent.selectOptions(form.getByLabelText("Receivable account"), "a-rec");
    await userEvent.type(form.getByLabelText("Payer"), "Sample Kiosk");
    await userEvent.type(form.getByLabelText("Amount"), "1200");
    await userEvent.type(form.getByLabelText("Due date"), "2026-05-01");
    await userEvent.type(form.getByLabelText("Narration"), "May kiosk fee");
    await userEvent.click(form.getByRole("button", { name: "Raise bill" }));

    await waitFor(() => expect(callsTo("accounting_bill_create")).toHaveLength(1));
    expect(callsTo("accounting_bill_create")[0][2]).toEqual({
      income_account_id: "a-inc",
      receivable_account_id: "a-rec",
      payer: "Sample Kiosk",
      amount: 1200,
      due_at: "2026-05-01T00:00:00Z",
      narration: "May kiosk fee",
    });
    expect(await screen.findByText("1,200 · due 2026-05-01")).toBeInTheDocument();
    expect(within(rowOf(/Sample Kiosk/)).getByText("Open")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("offers only income accounts as the income account and receivable accounts as the receivable account", async () => {
    screens();
    await userEvent.click(await screen.findByRole("button", { name: "Raise bill" }));
    const form = within(await screen.findByRole("dialog"));

    await waitFor(() => expect(form.getByLabelText("Income account")).toHaveTextContent("Market fees"));
    expect(form.getByLabelText("Income account")).not.toHaveTextContent("Cash");
    expect(form.getByLabelText("Receivable account")).toHaveTextContent("Receivables");
    expect(form.getByLabelText("Receivable account")).not.toHaveTextContent("Market fees");
  });

  it("puts Raise bill inside the empty card when there are no bills", async () => {
    screens({ ...answers, accounting_bill_list: () => ({ items: [] }) });

    expect(await screen.findByText("No bills yet.")).toBeInTheDocument();
    expect(await screen.findAllByRole("button", { name: "Raise bill" })).toHaveLength(1);
  });

  it("keeps the empty card to its Home button for a caller without accounting.manage", async () => {
    screens({ ...withoutManage, accounting_bill_list: () => ({ items: [] }) });

    expect(await screen.findByText("No bills yet.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Raise bill" })).toBeNull();
    expect(screen.getByRole("button", { name: "Home" })).toBeInTheDocument();
  });
});

describe("filtering by status", () => {
  it("has the chips All, Open, Overdue, Settled and Reversed, All pressed first", async () => {
    screens();
    await screen.findByText("Sample Bakery");

    ["All", "Open", "Overdue", "Settled", "Reversed"].forEach((name) => expect(screen.getByRole("button", { name })).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "true");
  });

  it.each([
    ["Open", "open", "Sample Market"],
    ["Overdue", "overdue", "Sample Garage"],
    ["Settled", "settled", "Sample Bakery"],
    ["Reversed", "reversed", "Sample School"],
  ])("%s asks accounting_bill_list for status %s and lists only that bill", async (chip, status, payer) => {
    screens();
    await screen.findByText("Sample Bakery");

    await userEvent.click(screen.getByRole("button", { name: chip }));

    await waitFor(() => expect(callsTo("accounting_bill_list").some(([, , args]) => (args as Args)?.status === status)).toBe(true));
    expect(await screen.findByText(payer)).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText(/^Sample /)).toHaveLength(1));
    expect(screen.getByRole("button", { name: chip })).toHaveAttribute("aria-pressed", "true");
  });

  it("All brings every bill back", async () => {
    screens();
    await screen.findByText("Sample Bakery");
    await userEvent.click(screen.getByRole("button", { name: "Open" }));
    await waitFor(() => expect(screen.queryByText("Sample Bakery")).toBeNull());

    await userEvent.click(screen.getByRole("button", { name: "All" }));

    expect(await screen.findByText("Sample Bakery")).toBeInTheDocument();
    expect(screen.getByText("Sample School")).toBeInTheDocument();
  });
});

describe("what was paid against a bill", () => {
  it("shows the narration and the payments of the bill, newest first, asking accounting_payment_list with bill_id", async () => {
    screens();
    await userEvent.click(await screen.findByRole("button", { name: /Sample Garage/ }));
    await waitFor(() => expect(pane().textContent).toContain("Second part"));

    expect(callsTo("accounting_payment_list")[0][2]).toEqual({ bill_id: "b2" });
    const detail = within(pane());
    expect(detail.getByText("March stall fee")).toBeInTheDocument();
    const text = pane().textContent ?? "";
    expect(text.indexOf("Second part")).toBeLessThan(text.indexOf("First part"));
    expect(detail.getByText("200 · 2026-02-10 · Second part")).toBeInTheDocument();
    expect(detail.getByText("300 · 2026-01-20 · First part")).toBeInTheDocument();
  });

  it("shows no payment lines for a bill nothing was paid against", async () => {
    screens();
    await userEvent.click(await screen.findByRole("button", { name: /Sample Market/ }));
    await waitFor(() => expect(pane().textContent).toContain("Sample Market"));

    expect(pane().textContent).not.toMatch(/Payment 1/);
  });
});

describe("Mark paid on a bill", () => {
  it.each(["Sample Market", "Sample Garage"])("is offered on %s, which is open or overdue", async (payer) => {
    screens();
    await userEvent.click(await screen.findByRole("button", { name: new RegExp(payer) }));
    await waitFor(() => expect(pane().textContent).toContain(payer));

    expect(within(pane()).getByRole("button", { name: "Mark paid" })).toBeInTheDocument();
  });

  it.each(["Sample Bakery", "Sample School"])("is not offered on %s, which is settled or reversed", async (payer) => {
    screens();
    await userEvent.click(await screen.findByRole("button", { name: new RegExp(payer) }));
    await waitFor(() => expect(pane().textContent).toContain(payer));

    expect(within(pane()).queryByRole("button", { name: "Mark paid" })).toBeNull();
  });

  it("posts accounting_payment_mark_paid with the billID and the cash account", async () => {
    screens({ ...answers, accounting_payment_mark_paid: () => ({}) });
    await userEvent.click(await screen.findByRole("button", { name: /Sample Market/ }));
    await waitFor(() => expect(pane().textContent).toContain("Sample Market"));

    await userEvent.click(within(pane()).getByRole("button", { name: "Mark paid" }));

    await waitFor(() => expect(callsTo("accounting_payment_mark_paid")).toHaveLength(1));
    expect(callsTo("accounting_payment_mark_paid")[0][2]).toEqual({ billID: "b3", cash_account_id: "a-cash" });
  });
});
