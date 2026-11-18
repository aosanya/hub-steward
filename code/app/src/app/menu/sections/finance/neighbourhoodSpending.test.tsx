import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { NeighbourhoodSpendingScreen } from "./NeighbourhoodSpendingScreen";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

const origin = { path: "/a/town/menu/finance", title: "Finance" };

const totals = [
  { value: "Kertváros", total: 1820000, entries: 1 },
  { value: "Malomsor", total: 4200000, entries: 2 },
  { value: "Óváros", total: 3150000, entries: 1 },
];

let called: MockInstance<typeof mcp.callTool>;
let listed: Record<string, string>;
let answer: unknown;

const pane = () => document.querySelector(".mw-detail") as HTMLElement;

beforeEach(() => {
  openAgency("town");
  listed = {};
  answer = { key: "neighbourhood", account_type: "expense", totals };
  called = vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name) => {
    if (name === "accounting_dimension_totals") return answer;
    if (name === "agency_get_agency") return { name: "Zoldhalom" };
    if (name === "agency_list_mounts") return { modules: [{ module: "accounting", mounts: [{ name: "Finance", key: "finance", words: listed }] }] };
    throw new Error(`${name} is not a tool this screen may use`);
  });
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  Reflect.deleteProperty(window, "matchMedia");
  vi.restoreAllMocks();
});

const setWide = (wide: boolean) => {
  window.matchMedia = ((query: string) => ({
    matches: wide,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })) as unknown as typeof window.matchMedia;
};

const open = (wide = false) => {
  setWide(wide);
  return render(
    <MemoryRouter initialEntries={[{ pathname: "/a/town/menu/finance/spending-by-neighbourhood", state: { from: origin } }]}>
      <Routes>
        <Route path="/a/:agencyId/menu/finance/spending-by-neighbourhood" element={<NeighbourhoodSpendingScreen />} />
        <Route path="*" element={null} />
      </Routes>
    </MemoryRouter>,
  );
};

const callsTo = (name: string) => called.mock.calls.filter(([, tool]) => tool === name);

describe("Spending by Neighbourhood", () => {
  it("lists each neighbourhood with what was spent there, from one read of the totals", async () => {
    open();

    expect(await screen.findByText("Malomsor")).toBeInTheDocument();
    expect(screen.getByText("Kertváros")).toBeInTheDocument();
    expect(screen.getByText("Óváros")).toBeInTheDocument();
    expect(screen.getByText("Spent 4,200,000")).toBeInTheDocument();
    expect(screen.getByText("Spent 1,820,000")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Spending by Neighbourhood" })).toBeInTheDocument();
    expect(callsTo("accounting_dimension_totals")).toHaveLength(1);
    expect(callsTo("accounting_dimension_totals")[0][2]).toEqual({ key: "neighbourhood", account_type: "expense" });
  });

  it("opens a neighbourhood with its name, what was spent and how many entries", async () => {
    open();
    await userEvent.click(await screen.findByRole("button", { name: /Malomsor/ }));

    await waitFor(() => expect(pane()).not.toBeNull());
    await waitFor(() => expect(pane().textContent).toContain("4,200,000"));
    expect(pane().textContent).toContain("Malomsor");
    expect(pane().textContent).toContain("2");
  });

  it("opens the first neighbourhood by itself on a wide screen", async () => {
    open(true);

    await waitFor(() => expect(pane()).not.toBeNull());
    await waitFor(() => expect(pane().textContent).toContain("1,820,000"));
    expect(pane().textContent).toContain("Kertváros");
  });

  it("follows the amounts with the hub's currency word when the accounting mount carries one", async () => {
    listed = { Currency: "Ft" };
    open();

    expect(await screen.findByText("Spent 4,200,000 Ft")).toBeInTheDocument();
  });

  it("says plainly that nothing has been spent by neighbourhood when the totals are empty", async () => {
    answer = { key: "neighbourhood", account_type: "expense", totals: [] };
    open();

    expect(await screen.findByText("No spending by neighbourhood yet.")).toBeInTheDocument();
  });
});
