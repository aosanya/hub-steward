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

const accounts = [
  { id: "ac1", code: "5000", category: "roads", type: "expense" },
  { id: "ac2", code: "5100", category: "books", type: "expense" },
];

const tenders = [{ id: "t1", title: "Resurface Main Street", status: "open", budget_id: "b1", quote_count: 2, lowest_amount: 800 }];

let landed = "";
let called: MockInstance<typeof mcp.callTool>;
let permissions: string[];
let stored: Record<string, unknown>[];
let refusal: string | null;

const Where = () => {
  landed = useLocation().pathname;
  return null;
};

const pane = () => document.querySelector(".mw-detail") as HTMLElement;

const callsTo = (name: string) => called.mock.calls.filter(([, tool]) => tool === name);

beforeEach(() => {
  openAgency("town");
  permissions = ["accounting.manage"];
  stored = [...lines];
  refusal = null;
  called = vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => {
    if (name === "agency_get_my_roles") return { permissions };
    if (name === "accounting_budget_list") return { items: stored };
    if (name === "accounting_budget_read") return stored.find((line) => line.id === (args as { budgetID: string }).budgetID) ?? {};
    if (name === "accounting_account_list") return { items: accounts };
    if (name === "accounting_tender_list") return { items: tenders.filter((tender) => tender.budget_id === (args as { budget_id: string }).budget_id) };
    if (name === "accounting_budget_set") {
      if (refusal) throw new mcp.McpError(`403: ${refusal}`);
      const made = args as Record<string, unknown>;
      const same = stored.findIndex((line) => line.account_id === made.account_id && line.period_start === made.period_start && line.period_end === made.period_end);
      if (same >= 0) {
        stored = stored.map((line, index) => (index === same ? { ...line, name: made.name, department: made.department, planned: Number(made.amount) } : line));
        return stored[same];
      }
      stored = [...stored, { id: "b3", spent: 0, planned: Number(made.amount), ...made }];
      return stored[stored.length - 1];
    }
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
    expect(pane().textContent).toContain("2026-01-01 to 2026-01-31");
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

  it("says so when the hub lists no budget lines, and the empty card carries the Add button", async () => {
    called.mockImplementation(async (_agency, name) => (name === "agency_get_my_roles" ? { permissions } : { items: [] }));
    open();

    expect(await screen.findByText("No budget lines yet.")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Add budget line" })).toBeInTheDocument();
  });
});

describe("a budget line's use", () => {
  it("shows what remains, the share spent and the tenders drawn on the line", async () => {
    open();
    await userEvent.click(await screen.findByRole("button", { name: /Sample Road Repairs/ }));

    await waitFor(() => expect(pane().textContent).toContain("Resurface Main Street"));
    expect(pane().textContent).toContain("Remaining");
    expect(pane().textContent).toContain("750");
    expect(pane().textContent).toContain("25%");
    expect(callsTo("accounting_tender_list")[0][2]).toEqual({ budget_id: "b1" });
  });

  it("draws no tenders row for a line without tenders", async () => {
    open();
    await userEvent.click(await screen.findByRole("button", { name: /Sample Library Books/ }));

    await waitFor(() => expect(pane().textContent).toContain("12,500"));
    expect(pane().textContent).not.toContain("Tenders");
  });
});

describe("adding a budget line", () => {
  const fillIn = async () => {
    await userEvent.click(await screen.findByRole("button", { name: "Add budget line" }));
    await userEvent.click(await screen.findByRole("button", { name: /Account/ }));
    await userEvent.click(await screen.findByRole("option", { name: /roads/ }));
    await userEvent.type(screen.getByLabelText("Name"), "Winter Salt");
    await userEvent.type(screen.getByLabelText("Department"), "Public Works");
    await userEvent.type(screen.getByLabelText("Period start"), "2026-03-01");
    await userEvent.type(screen.getByLabelText("Period end"), "2026-03-31");
    await userEvent.type(screen.getByLabelText("Amount"), "4000");
  };

  it("sets the line on accounting_budget_set and lists it with its planned and spent", async () => {
    open();
    await fillIn();
    await userEvent.click(screen.getByRole("button", { name: "Save budget line" }));

    expect(await screen.findByText("Winter Salt")).toBeInTheDocument();
    expect(screen.getByText("Planned 4,000 · Spent 0")).toBeInTheDocument();
    expect(callsTo("accounting_budget_set")[0][2]).toEqual({
      account_id: "ac1",
      name: "Winter Salt",
      department: "Public Works",
      period_start: "2026-03-01T00:00:00Z",
      period_end: "2026-04-01T00:00:00Z",
      amount: 4000,
    });
    expect(screen.queryByLabelText("Name")).toBeNull();
  });

  it("sends the typed last day of the period as the next day, so 2026-12-31 is sent as 2027-01-01", async () => {
    open();
    await userEvent.click(await screen.findByRole("button", { name: "Add budget line" }));
    await userEvent.click(await screen.findByRole("button", { name: /Account/ }));
    await userEvent.click(await screen.findByRole("option", { name: /roads/ }));
    await userEvent.type(screen.getByLabelText("Name"), "Year Salt");
    await userEvent.type(screen.getByLabelText("Period start"), "2026-01-01");
    await userEvent.type(screen.getByLabelText("Period end"), "2026-12-31");
    await userEvent.type(screen.getByLabelText("Amount"), "900");
    await userEvent.click(screen.getByRole("button", { name: "Save budget line" }));

    await screen.findByText("Year Salt");
    expect(callsTo("accounting_budget_set")[0][2]).toMatchObject({ period_start: "2026-01-01T00:00:00Z", period_end: "2027-01-01T00:00:00Z" });
    await userEvent.click(screen.getByRole("button", { name: /Year Salt/ }));
    await waitFor(() => expect(pane().textContent).toContain("2026-01-01 to 2026-12-31"));
  });

  it("keeps the form and shows the refusal in its own words", async () => {
    refusal = "you may not set a budget line";
    open();
    await fillIn();
    await userEvent.click(screen.getByRole("button", { name: "Save budget line" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("you may not set a budget line");
    expect(screen.getByLabelText("Name")).toHaveValue("Winter Salt");
  });

  it("does not save while the name or amount is missing", async () => {
    open();
    await userEvent.click(await screen.findByRole("button", { name: "Add budget line" }));

    expect(screen.getByRole("button", { name: "Save budget line" })).toBeDisabled();
  });

  it("shows no Add button to a caller without accounting.manage", async () => {
    permissions = ["accounting.read"];
    open();

    expect(await screen.findByText("Sample Road Repairs")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add budget line" })).toBeNull();
  });
});

describe("editing a budget line", () => {
  const openRoadLine = async () => {
    open();
    await userEvent.click(await screen.findByRole("button", { name: /Sample Road Repairs/ }));
    await waitFor(() => expect(pane().textContent).toContain("Public Works"));
  };

  const raisePlannedTo = async (amount: string) => {
    await userEvent.click(await screen.findByRole("button", { name: "Edit" }));
    const planned = screen.getByLabelText("Planned amount");
    await userEvent.clear(planned);
    await userEvent.type(planned, amount);
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
  };

  it("sets the line again on accounting_budget_set with its account and every field", async () => {
    await openRoadLine();
    await raisePlannedTo("1500");

    await waitFor(() => expect(callsTo("accounting_budget_set")).toHaveLength(1));
    const sent = callsTo("accounting_budget_set")[0][2] as Record<string, unknown>;
    expect(sent).toMatchObject({ account_id: "ac1", name: "Sample Road Repairs", department: "Public Works", period_start: "2026-01-01", period_end: "2026-02-01" });
    expect(Number(sent.amount)).toBe(1500);
  });

  it("shows the new planned amount in the list and the new Remaining and share spent in the line", async () => {
    await openRoadLine();
    await raisePlannedTo("1500");

    expect(await screen.findByText("Planned 1,500 · Spent 250")).toBeInTheDocument();
    await waitFor(() => expect(pane().textContent).toContain("1,250"));
    expect(pane().textContent).toContain("17%");
    expect(pane().textContent).not.toContain("750");
  });

  it("replaces the line and makes no second one", async () => {
    await openRoadLine();
    await raisePlannedTo("1500");

    expect(await screen.findByText("Planned 1,500 · Spent 250")).toBeInTheDocument();
    expect(stored).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: /Sample Road Repairs/ })).toHaveLength(1);
    expect(screen.getByRole("button", { name: /Sample Library Books/ })).toBeInTheDocument();
  });

  it("keeps the form open and shows the refusal in its own words", async () => {
    refusal = "you may not set a budget line";
    await openRoadLine();
    await raisePlannedTo("1500");

    expect(await screen.findByRole("alert")).toHaveTextContent("you may not set a budget line");
    expect(screen.getByLabelText("Planned amount")).toHaveValue("1500");
  });

  it("shows no Edit to a caller who holds only accounting.view", async () => {
    permissions = ["accounting.view"];
    await openRoadLine();

    await waitFor(() => expect(callsTo("agency_get_my_roles").length).toBeGreaterThan(0));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
  });
});
