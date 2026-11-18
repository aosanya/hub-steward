import { vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { BillsScreen } from "./BillsScreen";
import { PaymentListScreen } from "./PaymentListScreen";

type Args = Record<string, unknown> | undefined;

const accounts = [
  { id: "a-rates", code: "4100", name: "Local rates", category: "local_rates", type: "income" },
  { id: "a-stalls", code: "4200", name: "Market stall fees", category: "market_fees", type: "income" },
  { id: "a-rec", code: "1200", name: "Receivables", category: "receivable", type: "asset" },
];

const ratesBill = {
  id: "r1",
  income_account_id: "a-rates",
  payer: "Rózsa Sample",
  amount: 120000,
  settled: 0,
  outstanding: 120000,
  due_at: "2026-09-30T00:00:00Z",
  status: "overdue",
  days_overdue: 49,
  narration: "Property rates 2026, 12 Sample Street",
};

const stallBill = {
  id: "s1",
  income_account_id: "a-stalls",
  payer: "Pál Sample",
  amount: 7000,
  settled: 0,
  outstanding: 7000,
  due_at: "2026-10-31T00:00:00Z",
  status: "overdue",
  days_overdue: 18,
  narration: "Market stall fee for October 2026",
};

const unlistedBill = { ...stallBill, id: "u1", income_account_id: "a-gone", payer: "Ilona Sample" };

let bills: Record<string, unknown>[];
let accountsAnswer: () => unknown;
let called: ReturnType<typeof vi.spyOn>;

const answer = (name: string, args: Args) => {
  if (name === "accounting_bill_list") return { items: bills.filter((bill) => !args?.status || bill.status === args.status) };
  if (name === "accounting_bill_read") return bills.find((bill) => bill.id === args?.billID) ?? null;
  if (name === "accounting_account_list") return accountsAnswer();
  if (name === "accounting_payment_list") return { items: [] };
  if (name === "agency_get_my_roles") return { permissions: ["accounting.read"] };
  return { items: [] };
};

const rowOf = async (payer: RegExp) => (await screen.findByRole("button", { name: payer })) as HTMLElement;

const pane = () => document.querySelector(".mw-detail") as HTMLElement;

const openBills = (path: string, element: JSX.Element) =>
  render(
    <MemoryRouter initialEntries={[{ pathname: path, state: { from: { path: "/a/town/menu/finance", title: "Finance" } } }]}>
      <Routes>
        <Route path={path.replace("/town/", "/:agencyId/")} element={element} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  openAgency("town");
  bills = [ratesBill, stallBill];
  accountsAnswer = () => ({ items: accounts });
  called = vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => answer(name, args as Args));
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

describe("Finance > Payments, a rate and a fee on one list", () => {
  const open = () => openBills("/a/town/menu/finance/payments", <PaymentListScreen />);

  it("says on each To pay row which charge it is", async () => {
    open();

    expect((await rowOf(/Rózsa Sample/)).textContent).toContain("Local rates");
    expect((await rowOf(/Pál Sample/)).textContent).toContain("Market stall fees");
  });

  it("counts the rate and the fee together in the total owed", async () => {
    open();
    await rowOf(/Rózsa Sample/);

    expect(screen.getByText("Owed in total: 127,000 · 2 payers")).toBeInTheDocument();
  });

  it("names the charge in the detail of an owed bill", async () => {
    open();
    await userEvent.click(await rowOf(/Rózsa Sample/));

    await waitFor(() => expect(pane().textContent).toContain("Charge"));
    expect(within(pane()).getByText("Local rates")).toBeInTheDocument();
  });

  it("asks for the account list once to name the charges", async () => {
    open();
    await rowOf(/Rózsa Sample/);

    expect(called.mock.calls.filter(([, tool]) => tool === "accounting_account_list")).toHaveLength(1);
  });

  it("names no charge on a bill whose income account is not in the list", async () => {
    bills = [unlistedBill];
    open();

    const row = await rowOf(/Ilona Sample/);
    expect(row.textContent).toContain("7,000 · due 2026-10-31");
    expect(row.textContent).not.toContain("Market stall fees");
  });

  it("still lists the bills when the account list cannot be read", async () => {
    accountsAnswer = () => {
      throw new Error("accounting_account_list: refused");
    };
    open();

    expect((await rowOf(/Rózsa Sample/)).textContent).toContain("120,000 · due 2026-09-30");
  });
});

describe("Revenue & Billing, the Overdue tab", () => {
  const open = () => openBills("/a/town/menu/finance/revenue-and-billing", <BillsScreen />);

  it("says on each overdue row which charge it is", async () => {
    open();
    await userEvent.click(await screen.findByRole("button", { name: "Overdue" }));

    await waitFor(() => expect(screen.queryAllByRole("button", { name: /Sample/ }).length).toBeGreaterThan(1));
    expect((await rowOf(/Rózsa Sample/)).textContent).toContain("Local rates");
    expect((await rowOf(/Pál Sample/)).textContent).toContain("Market stall fees");
  });

  it("names the charge in the detail of a bill", async () => {
    open();
    await userEvent.click(await rowOf(/Pál Sample/));

    await waitFor(() => expect(pane().textContent).toContain("Charge"));
    expect(within(pane()).getByText("Market stall fees")).toBeInTheDocument();
  });
});
