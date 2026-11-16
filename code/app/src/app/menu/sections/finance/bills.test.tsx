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

const answers: Answers = {
  accounting_bill_list: () => ({ items: bills }),
  accounting_bill_read: (args) => bills.find((bill) => bill.id === args?.billID) ?? {},
};

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
