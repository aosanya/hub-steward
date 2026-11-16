import { vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { BillsScreen } from "./BillsScreen";
import { BudgetScreen } from "./BudgetScreen";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

const words = {
  Budget: "Spending Plan",
  "Budget line": "Plan row",
  "Budget lines": "Plan rows",
  "Revenue & Billing": "Receivables",
  Bills: "Invoices",
  Bill: "Invoice",
};

const answering = (listed: Record<string, string>) =>
  vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name) => {
    if (name === "agency_get_agency") return { name: "Zoldhalom" };
    if (name === "agency_list_mounts") return { modules: [{ module: "accounting", mounts: [{ name: "Finance", key: "finance", words: listed }] }] };
    if (name === "agency_get_my_roles") return { permissions: ["accounting.manage"] };
    return { items: [] };
  });

const show = (screen: JSX.Element) =>
  render(
    <MemoryRouter initialEntries={["/a/town/menu/finance"]}>{screen}</MemoryRouter>,
  );

beforeEach(() => openAgency("town"));

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

describe("finance screens read the agency's words", () => {
  it("shows the agency's words for the budget title, empty state and add button", async () => {
    answering(words);
    show(<BudgetScreen />);
    expect(await screen.findByText("No plan rows yet.")).toBeTruthy();
    expect(screen.getAllByText("Spending Plan").length).toBeGreaterThan(0);
    expect(await screen.findByRole("button", { name: "Add plan row" })).toBeTruthy();
  });

  it("shows the agency's words for the billing title and empty state", async () => {
    answering(words);
    show(<BillsScreen />);
    expect(await screen.findByText("No invoices yet.")).toBeTruthy();
    expect(screen.getAllByText("Receivables").length).toBeGreaterThan(0);
    expect(await screen.findByRole("button", { name: "Raise invoice" })).toBeTruthy();
  });

  it("shows the generic words when the agency lists none", async () => {
    answering({});
    show(<BudgetScreen />);
    expect(await screen.findByText("No budget lines yet.")).toBeTruthy();
    expect(screen.getAllByText("Budget").length).toBeGreaterThan(0);
    expect(await screen.findByRole("button", { name: "Add budget line" })).toBeTruthy();
    cleanup();
    show(<BillsScreen />);
    expect(await screen.findByText("No bills yet.")).toBeTruthy();
    expect(screen.getAllByText("Revenue & Billing").length).toBeGreaterThan(0);
    expect(await screen.findByRole("button", { name: "Raise bill" })).toBeTruthy();
  });
});
