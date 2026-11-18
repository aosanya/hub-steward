import { vi, type MockInstance } from "vitest";
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

const overdueBill = (id: string, payer: string, account: string, days: number) => ({
  id,
  income_account_id: account,
  payer,
  amount: 7000,
  settled: 0,
  outstanding: 7000,
  due_at: "2026-11-03T00:00:00Z",
  status: "overdue",
  days_overdue: days,
});

const stallFee = overdueBill("s1", "Pál Sample", "a-stalls", 15);
const ratesBill = overdueBill("r1", "Rózsa Sample", "a-rates", 15);
const feeInsideItsDays = overdueBill("s2", "Ilona Sample", "a-stalls", 9);
const feeWithoutRule = overdueBill("g1", "Gábor Sample", "a-gone", 1);

const rules: Record<string, string> = {
  "late_rule.a-stalls": JSON.stringify({ days: 14, role: "Finance officer" }),
  "late_rule.a-rates": JSON.stringify({ days: 60, role: "Mayor" }),
};

let bills: Record<string, unknown>[];
let called: MockInstance<typeof mcp.callTool>;

const answer = (name: string, args: Args) => {
  if (name === "accounting_bill_list") return { items: bills.filter((bill) => !args?.status || bill.status === args.status) };
  if (name === "accounting_bill_read") return bills.find((bill) => bill.id === args?.billID) ?? null;
  if (name === "accounting_account_list") return { items: accounts };
  if (name === "accounting_payment_list") return { items: [] };
  if (name === "agency_get_my_roles") return { permissions: ["accounting.read"] };
  if (name === "forms_catalog_setting_read") {
    const value = rules[String(args?.key)];
    if (value === undefined) throw new Error("forms_catalog_setting_read: setting not found");
    return { key: args?.key, value };
  }
  return { items: [] };
};

const rowOf = async (payer: RegExp) => (await screen.findByRole("button", { name: payer })) as HTMLElement;

const pane = () => document.querySelector(".mw-detail") as HTMLElement;

const openAt = (path: string, element: JSX.Element) =>
  render(
    <MemoryRouter initialEntries={[{ pathname: path, state: { from: { path: "/a/town/menu/finance", title: "Finance" } } }]}>
      <Routes>
        <Route path={path.replace("/town/", "/:agencyId/")} element={element} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  openAgency("town");
  bills = [stallFee, ratesBill, feeInsideItsDays, feeWithoutRule];
  called = vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => answer(name, args as Args));
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

describe.each([
  ["Payments", "/a/town/menu/finance/payments", <PaymentListScreen />],
  ["Revenue & Billing", "/a/town/menu/finance/bills", <BillsScreen />],
])("Finance > %s, the late rule of each charge", (_name, path, element) => {
  it("marks a stall fee past its 14 days as Late with its days late", async () => {
    openAt(path, element);

    const row = await rowOf(/Pál Sample/);
    expect(within(row).getByText("Late")).toBeInTheDocument();
    expect(row.textContent).toContain("15 days late");
  });

  it("keeps a rates bill 15 days past due as Overdue, not Late, inside its 60 days", async () => {
    openAt(path, element);

    const row = await rowOf(/Rózsa Sample/);
    expect(within(row).getByText("Overdue")).toBeInTheDocument();
    expect(within(row).queryByText("Late")).toBeNull();
  });

  it("keeps a stall fee 9 days past due as Overdue, not Late", async () => {
    openAt(path, element);

    const row = await rowOf(/Ilona Sample/);
    expect(within(row).getByText("Overdue")).toBeInTheDocument();
    expect(within(row).queryByText("Late")).toBeNull();
  });

  it("counts a charge with no rule as late from the day after its due date", async () => {
    openAt(path, element);

    const row = await rowOf(/Gábor Sample/);
    expect(within(row).getByText("Late")).toBeInTheDocument();
  });

  it("names the role that is reminded in the detail of a late bill", async () => {
    openAt(path, element);
    await userEvent.click(await rowOf(/Pál Sample/));

    await waitFor(() => expect(pane().textContent).toContain("Reminds"));
    expect(within(pane()).getByText("Finance officer")).toBeInTheDocument();
  });

  it("reads the rule of each charge once", async () => {
    openAt(path, element);
    await rowOf(/Pál Sample/);

    const keys = called.mock.calls.filter(([, tool]) => tool === "forms_catalog_setting_read").map(([, , args]) => (args as { key: string }).key);
    expect(keys.filter((key) => key === "late_rule.a-stalls")).toHaveLength(1);
  });
});
