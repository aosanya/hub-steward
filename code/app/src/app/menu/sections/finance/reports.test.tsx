import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { ReportsScreen } from "./ReportsScreen";

type Args = Record<string, unknown> | undefined;

const origin = { path: "/a/town/menu/finance", title: "Finance" };

const reports = [
  { name: "First quarter", period_start: "2026-01-01", period_end: "2026-04-01" },
  { name: "Second quarter", period_start: "2026-04-01", period_end: "2026-07-01" },
];

const figuresOf: Record<string, unknown> = {
  "2026-01-01": { planned: 12000, spent: 9500, difference: 2500, departments: [], balances: [] },
  "2026-04-01": { planned: 8000, spent: 8300, difference: -300, departments: [], balances: [] },
};

let landed = "";
let called: MockInstance<typeof mcp.callTool>;
let reportList: () => unknown;

const Where = () => {
  landed = useLocation().pathname;
  return null;
};

const callsTo = (name: string) => called.mock.calls.filter(([, tool]) => tool === name);

const pane = () => document.querySelector(".mw-detail") as HTMLElement;

const backButton = (name: RegExp) => screen.getByRole("button", { name });

const openReports = () =>
  render(
    <MemoryRouter initialEntries={[{ pathname: "/a/town/menu/finance/reports", state: { from: origin } }]}>
      <Routes>
        <Route path="/a/:agencyId/menu/finance/reports" element={<ReportsScreen />} />
        <Route path="*" element={null} />
      </Routes>
      <Where />
    </MemoryRouter>,
  );

beforeEach(() => {
  openAgency("town");
  reportList = () => ({ items: reports });
  called = vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => {
    if (name === "accounting_report_list") return reportList();
    if (name === "accounting_report_read") {
      const start = String((args as Args)?.period_start);
      const report = reports.find((one) => one.period_start === start);
      return { ...report, figures: figuresOf[start] };
    }
    throw new Error(`${name} is not a tool this screen may use`);
  });
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

describe("the Financial Reports list", () => {
  it("draws one row for each report, named with its period", async () => {
    openReports();

    expect(await screen.findByText("First quarter")).toBeInTheDocument();
    expect(screen.getByText("2026-01-01 to 2026-04-01")).toBeInTheDocument();
    expect(screen.getByText("Second quarter")).toBeInTheDocument();
    expect(screen.getByText("2026-04-01 to 2026-07-01")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Financial Reports" })).toBeInTheDocument();
    expect(callsTo("accounting_report_list")).toHaveLength(1);
  });

  it("opens the figures beside the list, asking for that report's period", async () => {
    openReports();
    await userEvent.click(await screen.findByRole("button", { name: /Second quarter/ }));

    await waitFor(() => expect(pane()).not.toBeNull());
    await waitFor(() => expect(pane().textContent).toContain("8,300"));
    expect(callsTo("accounting_report_read")[0][2]).toEqual({ period_start: "2026-04-01", period_end: "2026-07-01" });
    expect(pane().textContent).toContain("Second quarter");
    expect(pane().textContent).toContain("2026-04-01 to 2026-07-01");
    expect(pane().textContent).toContain("8,000");
    expect(pane().textContent).toContain("-300");
  });

  it("shows the planned, spent and difference of the first report", async () => {
    openReports();
    await userEvent.click(await screen.findByRole("button", { name: /First quarter/ }));

    await waitFor(() => expect(pane().textContent).toContain("9,500"));
    expect(pane().textContent).toContain("12,000");
    expect(pane().textContent).toContain("2,500");
  });

  it("goes back from an opened report to the list, and Back names Financial Reports", async () => {
    openReports();
    await userEvent.click(await screen.findByRole("button", { name: /First quarter/ }));
    await waitFor(() => expect(pane()).not.toBeNull());

    await userEvent.click(backButton(/‹ Financial Reports$/));

    expect(document.querySelector(".mw-detail")).toBeNull();
    expect(screen.getByText("Second quarter")).toBeInTheDocument();
  });

  it("names Finance on Back from the list, and goes there", async () => {
    openReports();
    await screen.findByText("First quarter");

    await userEvent.click(backButton(/Finance/));

    await waitFor(() => expect(landed).toBe(origin.path));
  });

  it("says so when the hub lists no reports", async () => {
    reportList = () => ({ items: [] });
    openReports();

    expect(await screen.findByText(/No reports/i)).toBeInTheDocument();
  });
});
