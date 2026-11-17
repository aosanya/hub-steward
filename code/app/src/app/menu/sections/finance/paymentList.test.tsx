import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { PaymentListScreen } from "./PaymentListScreen";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

const lateBill = { id: "b2", payer: "Csilla Sample", amount: 800, settled: 0, outstanding: 800, due_at: "2026-10-01T00:00:00Z", status: "overdue" };
const earlierPayment = { id: "p1", kind: "bill", amount: 450, paid_at: "2026-11-02T09:00:00Z", paid_by: "u1", bill_id: "b0", payer: "Ben Sample", narration: "Bank transfer" };
const settledBill = { id: "b0", payer: "Ben Sample", amount: 450, settled: 450, outstanding: 0, due_at: "2026-10-20T00:00:00Z", status: "paid" };

const accounts = [
  { id: "a1", code: "1000", name: "Receivables", category: "receivable", type: "asset" },
  { id: "a2", code: "1100", name: "Cash at bank", category: "cash", type: "asset" },
];

const origin = { path: "/a/town/menu/finance", title: "Finance" };

const today = new Date().toISOString().slice(0, 10);

let called: MockInstance<typeof mcp.callTool>;
let owed: number;
let made: Record<string, unknown>[];
let refusal: string;
let chart: unknown[];
let permissions: string[];

const callsTo = (name: string) => called.mock.calls.filter(([, tool]) => tool === name);

const pane = () => document.querySelector(".mw-detail") as HTMLElement;

const rowOf = async (payer: string) => (await screen.findByRole("button", { name: new RegExp(payer) })) as HTMLElement;

const owedRows = () => screen.queryAllByRole("button", { name: /Anna Sample/ }).filter((row) => within(row).queryByText("Unpaid") !== null);

const openScreen = () =>
  render(
    <MemoryRouter initialEntries={[{ pathname: "/a/town/menu/finance/payments", state: { from: origin } }]}>
      <Routes>
        <Route path="/a/:agencyId/menu/finance/payments" element={<PaymentListScreen />} />
      </Routes>
    </MemoryRouter>,
  );

const openForm = async () => {
  await waitFor(() => expect(owedRows()).toHaveLength(1));
  await userEvent.click(owedRows()[0]);
  await userEvent.click(await screen.findByRole("button", { name: "Mark paid" }));
  return screen.findByRole("dialog", { name: "Mark paid" });
};

const fill = async (form: HTMLElement, label: string, value: string) => {
  const field = within(form).getByLabelText(label);
  await userEvent.clear(field);
  if (value) await userEvent.type(field, value);
};

beforeEach(() => {
  openAgency("town");
  owed = 1200;
  made = [];
  refusal = "";
  chart = accounts;
  permissions = ["accounting.read", "accounting.manage"];
  called = vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => {
    const given = (args ?? {}) as Record<string, unknown>;
    if (name === "agency_get_my_roles") return { permissions };
    if (name === "accounting_bill_list") {
      if (given.status === "open") return { items: owed > 0 ? [{ id: "b1", payer: "Anna Sample", amount: 1500, settled: 1500 - owed, outstanding: owed, due_at: "2026-12-01T00:00:00Z", status: "open" }] : [] };
      if (given.status === "overdue") return { items: [lateBill] };
      return { items: [] };
    }
    if (name === "accounting_bill_read") return given.billID === "b0" ? settledBill : null;
    if (name === "accounting_payment_list") return { items: [earlierPayment, ...made] };
    if (name === "accounting_account_list") return { items: chart };
    if (name === "accounting_payment_mark_paid") {
      if (refusal) throw new mcp.McpError(`accounting_payment_mark_paid: ${refusal}`);
      const amount = Number(given.amount);
      owed -= amount;
      made.push({ id: `p${made.length + 2}`, kind: "bill", amount, paid_at: given.paid_on, paid_by: "u1", bill_id: "b1", payer: "Anna Sample", narration: given.narration ?? "" });
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

  it("opens a payment with payer, amount, paid on, narration and the bill it settled", async () => {
    openScreen();
    await userEvent.click(await rowOf("Ben Sample"));

    await waitFor(() => expect(pane().textContent).toContain("Narration"));
    expect(pane().textContent).toContain("Bank transfer");
    expect(pane().textContent).toContain("Bill");
    await waitFor(() => expect(pane().textContent).toContain("Ben Sample · 450 · due 2026-10-20"));
  });

  it("opens a small form with the outstanding amount and today filled in, and sends nothing yet", async () => {
    openScreen();
    const form = await openForm();

    expect(within(form).getByLabelText("Amount")).toHaveValue("1200");
    expect(within(form).getByLabelText("Paid on")).toHaveValue(today);
    expect(within(form).getByLabelText("Narration")).toHaveValue("");
    expect(callsTo("accounting_payment_mark_paid")).toHaveLength(0);
  });

  it("shows the Mark paid form inside the bill's detail screen, not behind the list", async () => {
    openScreen();
    const form = await openForm();

    expect(pane()).toContainElement(form);
    const inPane = within(pane()).getByRole("dialog", { name: "Mark paid" });
    expect(within(inPane).getByLabelText("Amount")).toBeInTheDocument();
    expect(within(inPane).getByLabelText("Paid on")).toBeInTheDocument();
    expect(within(inPane).getByLabelText("Narration")).toBeInTheDocument();
  });

  it("sends the amount, the day and the note with the cash account", async () => {
    openScreen();
    const form = await openForm();
    await fill(form, "Amount", "500");
    await fill(form, "Paid on", "2026-11-10");
    await fill(form, "Narration", "Cash at the counter");
    await userEvent.click(within(form).getByRole("button", { name: "Save" }));

    await waitFor(() => expect(callsTo("accounting_payment_mark_paid")).toHaveLength(1));
    expect(callsTo("accounting_payment_mark_paid")[0]).toEqual(["", "accounting_payment_mark_paid", { billID: "b1", cash_account_id: "a2", amount: 500, paid_on: "2026-11-10T00:00:00Z", narration: "Cash at the counter" }]);
  });

  it("leaves the row in To pay with the smaller outstanding amount after a part payment, then moves it to Paid when the rest is paid", async () => {
    openScreen();
    const form = await openForm();
    await fill(form, "Amount", "500");
    await userEvent.click(within(form).getByRole("button", { name: "Save" }));

    await waitFor(() => expect(owedRows().map((row) => row.textContent)).toEqual([expect.stringContaining("700 · due 2026-12-01")]));
    expect(screen.queryByRole("dialog")).toBeNull();

    const second = await openForm();
    expect(within(second).getByLabelText("Amount")).toHaveValue("700");
    await userEvent.click(within(second).getByRole("button", { name: "Save" }));

    await waitFor(() => expect(callsTo("accounting_payment_mark_paid")).toHaveLength(2));
    await waitFor(() => expect(owedRows()).toHaveLength(0));
    expect(screen.getAllByRole("button", { name: /Anna Sample/ })).toHaveLength(2);
  });

  it("will not save an amount that is not a positive number or a day that is not a date", async () => {
    openScreen();
    const form = await openForm();
    const save = within(form).getByRole("button", { name: "Save" });

    await fill(form, "Amount", "0");
    expect(save).toBeDisabled();
    await fill(form, "Amount", "abc");
    expect(save).toBeDisabled();
    await fill(form, "Amount", "100");
    expect(save).toBeEnabled();
    await fill(form, "Paid on", "yesterday");
    expect(save).toBeDisabled();
  });

  it("closes the form with Cancel and sends nothing", async () => {
    openScreen();
    const form = await openForm();
    await userEvent.click(within(form).getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(callsTo("accounting_payment_mark_paid")).toHaveLength(0);
  });

  it("shows the words of the refusal in the form when the payment is more than outstanding", async () => {
    refusal = "payment of 5000 is more than the outstanding 1200";
    openScreen();
    const form = await openForm();
    await fill(form, "Amount", "5000");
    await userEvent.click(within(form).getByRole("button", { name: "Save" }));

    expect(await within(form).findByText("payment of 5000 is more than the outstanding 1200")).toBeInTheDocument();
    expect(screen.queryByText(/did not go through/i)).toBeNull();
    expect(within(await rowOf("Anna Sample")).getByText("Unpaid")).toBeInTheDocument();
  });

  it("shows the words of the refusal when the caller is not permitted", async () => {
    refusal = "you do not hold accounting.manage";
    openScreen();
    const form = await openForm();
    await userEvent.click(within(form).getByRole("button", { name: "Save" }));

    expect(await within(form).findByText("you do not hold accounting.manage")).toBeInTheDocument();
  });

  it("says there is no cash account in its own words and sends nothing when the agency has none", async () => {
    chart = [accounts[0]];
    openScreen();
    const form = await openForm();
    await userEvent.click(within(form).getByRole("button", { name: "Save" }));

    expect(await within(form).findByText("There is no cash account to pay from.")).toBeInTheDocument();
    expect(callsTo("accounting_payment_mark_paid")).toHaveLength(0);
    expect(within(await rowOf("Anna Sample")).getByText("Unpaid")).toBeInTheDocument();
  });

  it("offers Mark paid only to a caller who holds accounting.manage", async () => {
    permissions = ["accounting.read"];
    openScreen();
    await userEvent.click(await rowOf("Anna Sample"));

    await waitFor(() => expect(pane().textContent).toContain("Outstanding"));
    expect(screen.queryByRole("button", { name: "Mark paid" })).toBeNull();
  });

  it("says so when nothing is owed and nothing was paid", async () => {
    called.mockImplementation(async () => ({ items: [] }));
    openScreen();

    expect(await screen.findByText("No payments yet.")).toBeInTheDocument();
  });
});
