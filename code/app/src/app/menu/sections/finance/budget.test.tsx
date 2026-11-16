import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { BudgetScreen } from "./BudgetScreen";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

const origin = { path: "/a/town/menu/finance", title: "Finance" };

const lines = [
  { id: "b1", name: "Sample Road Repairs", department: "Public Works", account_id: "ac1", period_start: "2026-01-01", period_end: "2026-02-01", planned: 1000, spent: 250 },
  { id: "b2", name: "Sample Library Books", department: "Library", account_id: "ac2", period_start: "2026-01-01", period_end: "2026-02-01", planned: 12500, spent: 0 },
];

let landed = "";
let called: MockInstance<typeof mcp.callTool>;

const Where = () => {
  landed = useLocation().pathname;
  return null;
};

const pane = () => document.querySelector(".mw-detail") as HTMLElement;

const callsTo = (name: string) => called.mock.calls.filter(([, tool]) => tool === name);

beforeEach(() => {
  openAgency("town");
  called = vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => {
    if (name === "accounting_budget_list") return { items: lines };
    if (name === "accounting_budget_read") return lines.find((line) => line.id === (args as { budgetID: string }).budgetID) ?? {};
    throw new Error(`${name} is not a tool this screen may use`);
  });
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

const open = () =>
  render(
    <MemoryRouter initialEntries={[{ pathname: "/a/town/menu/finance/budget", state: { from: origin } }]}>
      <Routes>
        <Route path="/a/:agencyId/menu/finance/budget" element={<BudgetScreen />} />
        <Route path="*" element={null} />
      </Routes>
      <Where />
    </MemoryRouter>,
  );

describe("the Budget list", () => {
  it("draws one row for each budget line, named by the line with its planned and spent", async () => {
    open();

    expect(await screen.findByText("Sample Road Repairs")).toBeInTheDocument();
    expect(screen.getByText("Planned 1,000 · Spent 250")).toBeInTheDocument();
    expect(screen.getByText("Sample Library Books")).toBeInTheDocument();
    expect(screen.getByText("Planned 12,500 · Spent 0")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Budget" })).toBeInTheDocument();
    expect(callsTo("accounting_budget_list")).toHaveLength(1);
  });

  it("opens the budget line beside the list with its name, department, period, planned and spent", async () => {
    open();
    await userEvent.click(await screen.findByRole("button", { name: /Sample Road Repairs/ }));

    await waitFor(() => expect(pane()).not.toBeNull());
    await waitFor(() => expect(pane().textContent).toContain("Public Works"));
    expect(pane().textContent).toContain("Sample Road Repairs");
    expect(pane().textContent).toContain("2026-01-01 to 2026-02-01");
    expect(pane().textContent).toContain("1,000");
    expect(pane().textContent).toContain("250");
    expect(callsTo("accounting_budget_read")[0][2]).toEqual({ budgetID: "b1" });
  });

  it("goes back from an opened line to the list, then to Finance", async () => {
    open();
    await userEvent.click(await screen.findByRole("button", { name: /Sample Road Repairs/ }));
    await waitFor(() => expect(pane()).not.toBeNull());

    await userEvent.click(screen.getByRole("button", { name: /‹ Budget$/ }));

    expect(document.querySelector(".mw-detail")).toBeNull();
    expect(screen.getByText("Sample Library Books")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Finance/ }));

    await waitFor(() => expect(landed).toBe(origin.path));
  });

  it("says so when the hub lists no budget lines", async () => {
    called.mockImplementation(async () => ({ items: [] }));
    open();

    expect(await screen.findByText(/No budget lines/i)).toBeInTheDocument();
  });
});
