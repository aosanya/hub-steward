import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { BudgetScreen } from "./BudgetScreen";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

type Args = Record<string, unknown> | undefined;

const resurfacing = { id: "b1", name: "Resurfacing of Fo utca", department: "Public works", account_id: "ac1", period_start: "2026-01-01", period_end: "2027-01-01", planned: 2000000, spent: 1000000 };

const sharedResurfacing = { ...resurfacing, follow_milestones: true, cost_shares: { Óváros: 60, Kertváros: 40 } };

const milestones = [{ id: "m1", account_id: "ac1", contract_id: "k1", name: "Base course laid", amount: 600, due_at: "2026-03-15T00:00:00Z", status: "planned", certified_amount: 0 }];

let stored: Record<string, unknown>;
let called: MockInstance<typeof mcp.callTool>;

const pane = () => document.querySelector(".mw-detail") as HTMLElement;

const callsTo = (name: string) => called.mock.calls.filter(([, tool]) => tool === name);

const answers: Record<string, (args: Args) => unknown> = {
  agency_get_my_roles: () => ({ permissions: ["accounting.manage"] }),
  accounting_budget_list: () => ({ items: [stored] }),
  accounting_budget_read: () => stored,
  accounting_account_list: () => ({ items: [{ id: "ac1", code: "5000", category: "roads", type: "expense" }] }),
  accounting_tender_list: () => ({ items: [] }),
  accounting_milestone_list: () => ({ items: milestones }),
  accounting_certificate_list: () => ({ items: [] }),
  accounting_budget_set: (args) => {
    const made = args as Record<string, unknown>;
    stored = { ...stored, name: made.name, department: made.department, planned: Number(made.amount), follow_milestones: made.follow_milestones, cost_shares: made.cost_shares };
    return stored;
  },
};

beforeEach(() => {
  openAgency("town");
  stored = resurfacing;
  called = vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => {
    if (!answers[name]) throw new Error(`${name} is not a tool this screen may use`);
    return answers[name](args as Args);
  });
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

const openLine = async () => {
  render(
    <MemoryRouter initialEntries={[{ pathname: "/a/town/menu/finance/budget", state: { from: { path: "/a/town/menu/finance", title: "Finance" } } }]}>
      <Routes>
        <Route path="/a/:agencyId/menu/finance/budget" element={<BudgetScreen />} />
        <Route path="*" element={null} />
      </Routes>
    </MemoryRouter>,
  );
  await userEvent.click(await screen.findByRole("button", { name: /Resurfacing of Fo utca/ }));
  await waitFor(() => expect(pane().textContent).toContain("Public works"));
};

const editLine = async () => {
  await userEvent.click(await screen.findByRole("button", { name: "Edit" }));
};

const save = () => userEvent.click(screen.getByRole("button", { name: "Save" }));

const setShares = async (text: string) => {
  const shares = screen.getByLabelText("Cost shares");
  await userEvent.clear(shares);
  await userEvent.type(shares, text);
};

describe("a budget line that does not follow milestones", () => {
  it("shows no milestones and no payment certificates and does not read them", async () => {
    await openLine();

    await waitFor(() => expect(pane().textContent).toContain("2,000,000"));
    expect(pane().textContent).not.toContain("Milestones");
    expect(pane().textContent).not.toContain("Base course laid");
    expect(callsTo("accounting_milestone_list")).toHaveLength(0);
  });
});

describe("a budget line that follows milestones", () => {
  it("shows its milestones", async () => {
    stored = { ...resurfacing, follow_milestones: true };
    await openLine();

    await waitFor(() => expect(pane().textContent).toContain("Base course laid"));
  });
});

describe("a budget line whose cost is shared", () => {
  it("says how the cost falls on the neighbourhoods", async () => {
    stored = sharedResurfacing;
    await openLine();

    await waitFor(() => expect(pane().textContent).toContain("Cost shared"));
    expect(pane().textContent).toContain("Óváros 60%, Kertváros 40%");
  });

  it("says nothing about sharing on a line counted in one", async () => {
    await openLine();

    await waitFor(() => expect(pane().textContent).toContain("2,000,000"));
    expect(pane().textContent).not.toContain("Cost shared");
  });
});

describe("setting a budget line to follow milestones and share its cost", () => {
  it("sends follow_milestones true and keeps the rest of the line when Follow milestones is turned on", async () => {
    await openLine();
    await editLine();
    await userEvent.click(screen.getByRole("radio", { name: "On" }));
    await save();

    await waitFor(() => expect(callsTo("accounting_budget_set")).toHaveLength(1));
    expect(callsTo("accounting_budget_set")[0][2]).toEqual({
      account_id: "ac1",
      name: "Resurfacing of Fo utca",
      department: "Public works",
      amount: 2000000,
      period_start: "2026-01-01",
      period_end: "2027-01-01",
      follow_milestones: true,
      cost_shares: {},
    });
  });

  it("sends the percent for each neighbourhood when the cost is shared 60 to Óváros and 40 to Kertváros", async () => {
    await openLine();
    await editLine();
    await userEvent.click(screen.getByRole("radio", { name: "Shared" }));
    await setShares("Óváros 60\nKertváros 40");
    await save();

    await waitFor(() => expect(callsTo("accounting_budget_set")).toHaveLength(1));
    expect(callsTo("accounting_budget_set")[0][2]).toMatchObject({ follow_milestones: false, cost_shares: { Óváros: 60, Kertváros: 40 } });
  });

  it("keeps the shares and the milestone switch when only the name is changed", async () => {
    stored = sharedResurfacing;
    await openLine();
    await editLine();
    const name = screen.getByLabelText("Name");
    await userEvent.clear(name);
    await userEvent.type(name, "Resurfacing of Fo utca, stage one");
    await save();

    await waitFor(() => expect(callsTo("accounting_budget_set")).toHaveLength(1));
    expect(callsTo("accounting_budget_set")[0][2]).toMatchObject({ name: "Resurfacing of Fo utca, stage one", follow_milestones: true, cost_shares: { Óváros: 60, Kertváros: 40 } });
  });

  it("sends no shares when the line is set back to counted in one", async () => {
    stored = sharedResurfacing;
    await openLine();
    await editLine();
    await userEvent.click(screen.getByRole("radio", { name: "Counted in one" }));
    await save();

    await waitFor(() => expect(callsTo("accounting_budget_set")).toHaveLength(1));
    expect(callsTo("accounting_budget_set")[0][2]).toMatchObject({ cost_shares: {} });
  });

  it("refuses a share line that gives no percent, in words, and sends nothing", async () => {
    await openLine();
    await editLine();
    await userEvent.click(screen.getByRole("radio", { name: "Shared" }));
    await setShares("Óváros");
    await save();

    expect(await screen.findByRole("alert")).toHaveTextContent("Write each share as a neighbourhood and a percent, such as Óváros 60");
    expect(callsTo("accounting_budget_set")).toHaveLength(0);
  });
});
