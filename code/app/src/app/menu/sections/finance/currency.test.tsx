import { vi, type MockInstance } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { moduleOf, type AgencyView } from "../../../../features/agency/modules";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { headById, titleOf } from "../../sectionHeads";
import { BillsScreen } from "./BillsScreen";
import { BudgetScreen } from "./BudgetScreen";
import { PaymentListScreen } from "./PaymentListScreen";
import { ReportsScreen } from "./ReportsScreen";
import { TendersScreen } from "./TendersScreen";
import { UpwardReportScreen } from "./UpwardReportScreen";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

type Args = Record<string, unknown> | undefined;

const origin = { path: "/a/town/menu/finance", title: "Finance" };

const budgetLines = [
  { id: "b1", name: "Sample Road Repairs", department: "Public Works", account_id: "ac1", period_start: "2026-01-01", period_end: "2026-02-01", planned: 4500000, spent: 1820000 },
  { id: "b2", name: "Sample Library Books", department: "Library", account_id: "ac2", period_start: "2026-01-01", period_end: "2026-02-01", planned: 600000, spent: 0 },
];

const tenders = [{ id: "t2", budget_id: "b1", title: "Printer paper", closes_at: "2026-05-01T00:00:00Z", quote_count: 2, lowest_amount: 1200000 }];

const quotes = [
  { id: "q1", tender_id: "t2", supplier: "Acme Supplies", amount: 1250000 },
  { id: "q2", tender_id: "t2", supplier: "Beta Traders", amount: 1200000 },
];

const owedBill = { id: "b1", payer: "Anna Sample", amount: 2500000, settled: 500000, outstanding: 2000000, due_at: "2026-12-01T00:00:00Z", status: "open" };
const lateBill = { id: "b2", payer: "Csilla Sample", amount: 800000, settled: 0, outstanding: 800000, due_at: "2026-10-01T00:00:00Z", status: "overdue", days_overdue: 40 };
const settledBill = { id: "b0", payer: "Ben Sample", amount: 450000, settled: 450000, outstanding: 0, due_at: "2026-10-20T00:00:00Z", status: "paid" };
const earlierPayment = { id: "p1", kind: "bill", amount: 450000, paid_at: "2026-11-02T09:00:00Z", paid_by: "u1", bill_id: "b0", payer: "Ben Sample", narration: "Bank transfer" };

const billed = [
  { id: "r1", payer: "Sample Garage", amount: 1500000, settled: 500000, outstanding: 1000000, due_at: "2026-01-15T00:00:00Z", status: "overdue", days_overdue: 40 },
];

const billPayments = [{ id: "bp2", kind: "bill", amount: 200000, paid_at: "2026-02-10T00:00:00Z", narration: "Second part", bill_id: "r1", payer: "Sample Garage" }];

const reports = [{ name: "First quarter", period_start: "2026-01-01", period_end: "2026-04-01" }];

const reportFigures = { planned: 12000000, spent: 9500000, difference: 2500000, departments: [], balances: [] };

const reportLines = [
  { id: "l1", name: "Road repair", department: "Public works", planned: 7000000, spent: 5000000 },
  { id: "l2", name: "Library roof", department: "Culture", planned: 5000000, spent: 4500000 },
];

const earlierUpward = {
  id: "u1",
  kind: "budget_and_actuals",
  period_start: "2026-01-01T00:00:00Z",
  period_end: "2026-04-01T00:00:00Z",
  planned: 12000000,
  spent: 9500000,
  difference: 2500000,
  sent_at: "2026-04-10T08:30:00Z",
};

const thirdQuarter = { planned: 9000000, spent: 8100000, difference: 900000 };

let called: MockInstance<typeof mcp.callTool>;

const callsTo = (name: string) => called.mock.calls.filter(([, tool]) => tool === name);

const agencyWith = (listed: Record<string, string>) => ({
  agency_get_agency: () => ({ name: "Zoldhalom" }),
  agency_list_mounts: () => ({ modules: [{ module: "accounting", mounts: [{ name: "Finance", key: "finance", words: listed }] }] }),
});

const accountingAnswers: Record<string, (args: Args) => unknown> = {
  agency_get_my_roles: () => ({ permissions: ["accounting.view", "accounting.manage"] }),
  accounting_budget_list: () => ({ items: budgetLines }),
  accounting_budget_read: (args) => budgetLines.find((line) => line.id === args?.budgetID) ?? {},
  accounting_account_list: () => ({ items: [] }),
  accounting_tender_list: (args) => ({ items: args?.budget_id && args.budget_id !== "b1" ? [] : tenders }),
  accounting_tender_read: (args) => tenders.find((tender) => tender.id === args?.tenderID) ?? {},
  accounting_quote_list: (args) => ({ items: quotes.filter((quote) => quote.tender_id === args?.tenderID) }),
  accounting_bill_list: (args) => {
    if (args?.status === "open") return { items: [owedBill] };
    if (args?.status === "overdue") return { items: [lateBill] };
    if (args?.status) return { items: [] };
    return { items: billed };
  },
  accounting_bill_read: (args) => (args?.billID === "b0" ? settledBill : { ...billed.find((bill) => bill.id === args?.billID), narration: "March stall fee" }),
  accounting_payment_list: (args) => ({ items: args?.bill_id ? billPayments.filter((payment) => payment.bill_id === args.bill_id) : [earlierPayment] }),
  accounting_report_list: () => ({ items: reports }),
  accounting_report_read: (args) => {
    const start = String(args?.period_start).slice(0, 10);
    if (start === "2026-07-01") return { name: "Third quarter", figures: thirdQuarter, lines: [] };
    return { ...reports[0], figures: reportFigures, lines: reportLines };
  },
  accounting_upward_report_list: () => ({ items: [earlierUpward] }),
};

const answering = (listed: Record<string, string>) => {
  const answers: Record<string, (args: Args) => unknown> = { ...accountingAnswers, ...agencyWith(listed) };
  called = vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => (answers[name] ? answers[name](args as Args) : { items: [] }));
};

const show = (path: string, element: JSX.Element) =>
  render(
    <MemoryRouter initialEntries={[{ pathname: `/a/town/menu/finance/${path}`, state: { from: origin } }]}>
      <Routes>
        <Route path={`/a/:agencyId/menu/finance/${path}`} element={element} />
        <Route path="*" element={null} />
      </Routes>
    </MemoryRouter>,
  );

const pane = () => document.querySelector(".mw-detail") as HTMLElement;

const wordsRead = async () => {
  await waitFor(() => expect(callsTo("agency_list_mounts").length).toBeGreaterThan(0));
  await act(async () => undefined);
};

const rowOf = async (name: RegExp) => (await screen.findByRole("button", { name })) as HTMLElement;

beforeEach(() => openAgency("town"));

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

const cases: { when: string; listed: Record<string, string>; unit: string }[] = [
  { when: "the accounting mount carries the word Currency = Ft", listed: { Currency: "Ft" }, unit: " Ft" },
  { when: "the accounting mount carries no word for Currency", listed: {}, unit: "" },
];

describe.each(cases)("when $when", ({ listed, unit }) => {
  const nothingElseAfterNumbers = (shown: string) => {
    if (unit === "") expect(shown).not.toMatch(/\bFt\b|Currency/);
  };

  it(`draws the Budget list rows as Planned and Spent amounts${unit ? " followed by the unit" : " with bare numbers"}`, async () => {
    answering(listed);
    show("budget", <BudgetScreen />);
    await wordsRead();

    await waitFor(() => expect(screen.getByText(`Planned 4,500,000${unit} · Spent 1,820,000${unit}`)).toBeInTheDocument());
    expect(screen.getByText(`Planned 600,000${unit} · Spent 0${unit}`)).toBeInTheDocument();
    nothingElseAfterNumbers(document.body.textContent ?? "");
  });

  it(`draws a Budget line with planned, spent and remaining${unit ? " followed by the unit" : " as bare numbers"}`, async () => {
    answering(listed);
    show("budget", <BudgetScreen />);
    await userEvent.click(await rowOf(/Sample Road Repairs/));
    await wordsRead();

    await waitFor(() => expect(pane().textContent).toContain(`4,500,000${unit}`));
    expect(pane().textContent).toContain(`1,820,000${unit}`);
    expect(pane().textContent).toContain(`2,680,000${unit}`);
    nothingElseAfterNumbers(pane().textContent ?? "");
  });

  it(`draws the lowest quote of a tender in Procurement${unit ? " followed by the unit" : " as a bare number"}`, async () => {
    answering(listed);
    show("procurement", <TendersScreen />);
    await wordsRead();

    await waitFor(() => expect(screen.getByText(new RegExp(`2 quotes · lowest 1,200,000${unit}$`))).toBeInTheDocument());
    nothingElseAfterNumbers(document.body.textContent ?? "");
  });

  it(`draws each quote of a tender in Procurement${unit ? " followed by the unit" : " as a bare number"}`, async () => {
    answering(listed);
    show("procurement", <TendersScreen />);
    await userEvent.click(await rowOf(/Printer paper/));
    await wordsRead();

    await waitFor(() => expect(pane().textContent).toContain("Acme Supplies"));
    await waitFor(() => expect(pane().textContent).toContain(`1,250,000${unit}`));
    expect(pane().textContent).toContain(`1,200,000${unit}`);
    nothingElseAfterNumbers(pane().textContent ?? "");
  });

  it(`draws the amount outstanding of each bill owed in Payments${unit ? " followed by the unit" : " as a bare number"}`, async () => {
    answering(listed);
    show("payments", <PaymentListScreen />);
    await wordsRead();

    const anna = await rowOf(/Anna Sample/);
    await waitFor(() => expect(within(anna).getByText(`2,000,000${unit} · due 2026-12-01`)).toBeInTheDocument());
    const csilla = await rowOf(/Csilla Sample/);
    expect(within(csilla).getByText(`800,000${unit} · due 2026-10-01 · 40 days late`)).toBeInTheDocument();
    nothingElseAfterNumbers(document.body.textContent ?? "");
  });

  it(`draws the Owed in total line in Payments${unit ? " with the unit after the amount, before the payers" : " with a bare amount"}`, async () => {
    answering(listed);
    show("payments", <PaymentListScreen />);
    await wordsRead();

    await waitFor(() => expect(screen.getByText(`Owed in total: 2,800,000${unit} · 2 payers`)).toBeInTheDocument());
  });

  it(`draws a payment made and the bill it settled in Payments${unit ? " followed by the unit" : " as bare numbers"}`, async () => {
    answering(listed);
    show("payments", <PaymentListScreen />);
    const ben = await rowOf(/Ben Sample/);
    await wordsRead();

    await waitFor(() => expect(within(ben).getByText(`450,000${unit} · 2026-11-02`)).toBeInTheDocument());
    await userEvent.click(ben);
    await waitFor(() => expect(pane().textContent).toContain(`Ben Sample · 450,000${unit} · due 2026-10-20`));
    nothingElseAfterNumbers(pane().textContent ?? "");
  });

  it(`draws the outstanding amount of a bill opened in Payments${unit ? " followed by the unit" : " as a bare number"}`, async () => {
    answering(listed);
    show("payments", <PaymentListScreen />);
    await userEvent.click(await rowOf(/Anna Sample/));
    await wordsRead();

    await waitFor(() => expect(pane().textContent).toContain(`2,000,000${unit}`));
    nothingElseAfterNumbers(pane().textContent ?? "");
  });

  it(`draws each bill in Revenue & Billing with its amount${unit ? " followed by the unit" : " as a bare number"}`, async () => {
    answering(listed);
    show("revenue-and-billing", <BillsScreen />);
    await wordsRead();

    await waitFor(() => expect(within(screen.getByRole("button", { name: /Sample Garage/ })).getByText(`1,500,000${unit} · due 2026-01-15 · 40 days late`)).toBeInTheDocument());
    nothingElseAfterNumbers(document.body.textContent ?? "");
  });

  it(`draws a bill opened in Revenue & Billing with amount, settled and outstanding${unit ? " followed by the unit" : " as bare numbers"}`, async () => {
    answering(listed);
    show("revenue-and-billing", <BillsScreen />);
    await userEvent.click(await rowOf(/Sample Garage/));
    await wordsRead();

    await waitFor(() => expect(within(pane()).getByText(`1,500,000${unit}`)).toBeInTheDocument());
    expect(within(pane()).getByText(`500,000${unit}`)).toBeInTheDocument();
    expect(within(pane()).getByText(`1,000,000${unit}`)).toBeInTheDocument();
    await waitFor(() => expect(within(pane()).getByText(`200,000${unit} · 2026-02-10 · Recorded by Unnamed person · Second part`)).toBeInTheDocument());
    nothingElseAfterNumbers(pane().textContent ?? "");
  });

  it(`draws the planned, spent and difference of an opened Financial Report${unit ? " followed by the unit" : " as bare numbers"}`, async () => {
    answering(listed);
    show("reports", <ReportsScreen />);
    await userEvent.click(await rowOf(/First quarter/));
    await wordsRead();

    await waitFor(() => expect(pane().textContent).toContain(`9,500,000${unit}`));
    expect(pane().textContent).toContain(`12,000,000${unit}`);
    expect(pane().textContent).toContain(`2,500,000${unit}`);
    nothingElseAfterNumbers(pane().textContent ?? "");
  });

  it(`draws the budget lines of an opened Financial Report with planned and spent${unit ? " followed by the unit" : " as bare numbers"}`, async () => {
    answering(listed);
    show("reports", <ReportsScreen />);
    await userEvent.click(await rowOf(/First quarter/));
    await wordsRead();

    await waitFor(() => expect(pane().textContent).toContain(`Planned 7,000,000${unit} · Spent 5,000,000${unit}`));
    expect(pane().textContent).toContain(`Planned 5,000,000${unit} · Spent 4,500,000${unit}`);
  });

  it(`draws the figures of a period shown in the National Report${unit ? " followed by the unit" : " as bare numbers"}`, async () => {
    answering(listed);
    show("national-report", <UpwardReportScreen />);
    await screen.findByText("Sent reports");
    await act(async () => undefined);
    const form = screen.getByRole("region", { name: "Report to send" });
    fireEvent.change(within(form).getByLabelText("From"), { target: { value: "2026-07-01" } });
    fireEvent.change(within(form).getByLabelText("To"), { target: { value: "2026-09-30" } });
    await userEvent.click(within(form).getByRole("button", { name: "Show figures" }));

    const figures = () => document.querySelector(".person-page") as HTMLElement;
    await waitFor(() => expect(figures().textContent).toContain(`8,100,000${unit}`));
    expect(figures().textContent).toContain(`9,000,000${unit}`);
    expect(figures().textContent).toContain(`900,000${unit}`);
    nothingElseAfterNumbers(figures().textContent ?? "");
  });

  it(`draws a sent National Report with its figures as sent${unit ? " followed by the unit" : " as bare numbers"}`, async () => {
    const page = () => document.querySelector(".person-page") as HTMLElement;
    answering(listed);
    show("national-report", <UpwardReportScreen />);
    const sent = await screen.findByRole("region", { name: "Sent reports" });
    await waitFor(() => expect(sent.querySelector("button.row")).not.toBeNull());
    await userEvent.click(sent.querySelector("button.row") as HTMLElement);
    await act(async () => undefined);

    await waitFor(() => expect(page()?.textContent).toContain(`12,000,000${unit}`));
    expect(page().textContent).toContain(`9,500,000${unit}`);
    expect(page().textContent).toContain(`2,500,000${unit}`);
    nothingElseAfterNumbers(page().textContent ?? "");
  });
});

describe("the Finance section's own name", () => {
  const finance = headById("finance")!;

  it("is still Finance when the accounting module carries a mount named Finance and the word Currency = Ft", () => {
    const view: AgencyView = {
      name: "Zoldhalom",
      modules: [{ code: "accounting", name: "Finance", mountNames: ["Finance"], words: { Currency: "Ft" } }],
    };

    expect(titleOf(finance, view)).toBe("Finance");
  });

  it("is still Finance when the same module is read from the mounts the hub lists", () => {
    const view: AgencyView = {
      name: "Zoldhalom",
      modules: [moduleOf({ module: "accounting", mounts: [{ name: "Finance", key: "finance", words: { Currency: "Ft" } }] })],
    };

    expect(view.modules[0].words).toEqual({ Currency: "Ft" });
    expect(titleOf(finance, view)).toBe("Finance");
  });
});
