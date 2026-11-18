import { vi, type MockInstance } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

const thirdReport = { name: "Third quarter", period_start: "2026-07-01", period_end: "2026-10-01" };

type DepartmentFigure = { department: string; planned: number; spent: number; difference: number };

type Figures = { planned: number; spent: number; difference: number; departments: DepartmentFigure[] };

const figuresOf: Record<string, Figures & { balances: unknown[] }> = {
  "2026-01-01": {
    planned: 12000,
    spent: 9500,
    difference: 2500,
    departments: [
      { department: "Public works", planned: 7000, spent: 5000, difference: 2000 },
      { department: "Culture", planned: 5000, spent: 4500, difference: 500 },
    ],
    balances: [],
  },
  "2026-04-01": {
    planned: 8000,
    spent: 8300,
    difference: -300,
    departments: [
      { department: "Transport", planned: 3000, spent: 3100, difference: -100 },
      { department: "Public works", planned: 5000, spent: 5200, difference: -200 },
    ],
    balances: [],
  },
  "2026-07-01": {
    planned: 6000,
    spent: 4000,
    difference: 2000,
    departments: [
      { department: "Parks", planned: 4000, spent: 3000, difference: 1000 },
      { department: "", planned: 2000, spent: 1000, difference: 1000 },
    ],
    balances: [],
  },
};

const sumOf = (figures: Figures, key: "planned" | "spent" | "difference") =>
  figures.departments.reduce((sum, one) => sum + one[key], 0);

const linesOf: Record<string, unknown[]> = {
  "2026-01-01": [
    { id: "b1", name: "Road repair", department: "Public works", planned: 7000, spent: 5000 },
    { id: "b2", name: "Library roof", department: "Culture", planned: 5000, spent: 4500 },
  ],
  "2026-04-01": [
    { id: "b3", name: "Bus shelters", department: "Transport", planned: 3000, spent: 3100 },
    { id: "b4", name: "Park lighting", department: "Public works", planned: 5000, spent: 5200 },
  ],
  "2026-07-01": [
    { id: "b5", name: "Playground", department: "Parks", planned: 4000, spent: 3000 },
    { id: "b6", name: "Office supplies", department: "", planned: 2000, spent: 1000 },
  ],
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

const listPane = () => document.querySelector(".mw-list") as HTMLElement;

const departmentLine = (name: string) => {
  const rows = Array.from(within(pane()).getByRole("region", { name: "Departments" }).querySelectorAll(".row"));
  const row = rows.find((one) => one.querySelector(".ttl")?.textContent === name);
  return row ? [row.querySelector(".ttl")?.textContent, ...Array.from(row.querySelectorAll(".meta")).map((meta) => meta.textContent)].join(" · ") : "";
};

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
      const start = String((args as Args)?.period_start).slice(0, 10);
      const end = String((args as Args)?.period_end).slice(0, 10);
      const report = [...reports, thirdReport].find((one) => one.period_start === start && one.period_end === end);
      if (!report) throw new Error("no budget lines were set for that period");
      return { ...report, figures: figuresOf[start], lines: linesOf[start] };
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
    expect(screen.getByText("2026-01-01 to 2026-03-31")).toBeInTheDocument();
    expect(screen.getByText("Second quarter")).toBeInTheDocument();
    expect(screen.getByText("2026-04-01 to 2026-06-30")).toBeInTheDocument();
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
    expect(pane().textContent).toContain("2026-04-01 to 2026-06-30");
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

  it("lists the budget lines of an opened report with planned and spent that add to its totals", async () => {
    openReports();
    await userEvent.click(await screen.findByRole("button", { name: /First quarter/ }));

    await waitFor(() => expect(pane().textContent).toContain("Road repair"));
    expect(pane().textContent).toContain("Library roof");
    expect(pane().textContent).toContain("Planned 7,000 · Spent 5,000");
    expect(pane().textContent).toContain("Planned 5,000 · Spent 4,500");
    const planned = linesOf["2026-01-01"].reduce((sum: number, line) => sum + (line as { planned: number }).planned, 0);
    const spent = linesOf["2026-01-01"].reduce((sum: number, line) => sum + (line as { spent: number }).spent, 0);
    expect(planned).toBe(figuresOf["2026-01-01"] && (figuresOf["2026-01-01"] as { planned: number }).planned);
    expect(spent).toBe((figuresOf["2026-01-01"] as { spent: number }).spent);
  });
});

describe("the departments of an opened report", () => {
  it("names the Departments and shows each with its planned, spent and difference", async () => {
    openReports();
    await userEvent.click(await screen.findByRole("button", { name: /First quarter/ }));

    await waitFor(() => expect(pane().textContent).toContain("9,500"));
    expect(pane().textContent).toContain("Departments");
    expect(departmentLine("Public works")).toBe("Public works · Planned 7,000 · Spent 5,000 · Difference 2,000");
    expect(departmentLine("Culture")).toBe("Culture · Planned 5,000 · Spent 4,500 · Difference 500");
  });

  it("reads a department with an empty name as No department", async () => {
    reportList = () => ({ items: [...reports, thirdReport] });
    openReports();
    await userEvent.click(await screen.findByRole("button", { name: /Third quarter/ }));

    await waitFor(() => expect(departmentLine("Parks")).toBe("Parks · Planned 4,000 · Spent 3,000 · Difference 1,000"));
    expect(departmentLine("No department")).toBe("No department · Planned 2,000 · Spent 1,000 · Difference 1,000");
  });

  it.each(["2026-01-01", "2026-04-01", "2026-07-01"])(
    "has departments whose planned, spent and difference add up to the totals of the report starting %s",
    (start) => {
      const figures = figuresOf[start];
      expect(sumOf(figures, "planned")).toBe(figures.planned);
      expect(sumOf(figures, "spent")).toBe(figures.spent);
      expect(sumOf(figures, "difference")).toBe(figures.difference);
    },
  );

  it("prints a negative department difference with its minus sign", async () => {
    openReports();
    await userEvent.click(await screen.findByRole("button", { name: /Second quarter/ }));

    await waitFor(() => expect(pane().textContent).toContain("8,300"));
    expect(departmentLine("Transport")).toBe("Transport · Planned 3,000 · Spent 3,100 · Difference -100");
    expect(departmentLine("Public works")).toBe("Public works · Planned 5,000 · Spent 5,200 · Difference -200");
  });
});

describe("choosing a period", () => {
  const periodCard = () => screen.getByRole("region", { name: "Choose period" });

  const choose = async (start: string, end: string) => {
    await screen.findByText("First quarter");
    fireEvent.change(within(periodCard()).getByLabelText("From"), { target: { value: start } });
    fireEvent.change(within(periodCard()).getByLabelText("To"), { target: { value: end } });
    await userEvent.click(within(periodCard()).getByRole("button", { name: "Read report" }));
  };

  it("reads the report of the chosen period, sending the typed last day as the next day, and shows its totals and lines", async () => {
    openReports();
    await choose("2026-04-01", "2026-06-30");

    await waitFor(() => expect(listPane().textContent).toContain("8,300"));
    expect(callsTo("accounting_report_read")[0][2]).toEqual({ period_start: "2026-04-01T00:00:00Z", period_end: "2026-07-01T00:00:00Z" });
    expect(listPane().textContent).toContain("2026-04-01 to 2026-06-30");
    expect(listPane().textContent).toContain("Bus shelters");
    expect(listPane().textContent).toContain("-300");
  });

  it("shows the departments of the report of the chosen period", async () => {
    openReports();
    await choose("2026-04-01", "2026-06-30");

    await waitFor(() => expect(listPane().textContent).toContain("8,300"));
    expect(listPane().textContent).toContain("Departments");
    expect(listPane().textContent).toContain("Transport");
    expect(listPane().textContent).toContain("Planned 3,000 · Spent 3,100 · Difference -100");
    expect(listPane().textContent).toContain("Public works");
    expect(listPane().textContent).toContain("Planned 5,000 · Spent 5,200 · Difference -200");
  });

  it("refuses a reversed period in words and makes no call", async () => {
    openReports();
    await choose("2026-07-01", "2026-04-01");

    expect(await screen.findByText("The end date must not come before the start date.")).toBeInTheDocument();
    expect(callsTo("accounting_report_read")).toHaveLength(0);
  });

  it("allows a one-day period and asks for the next day as its end", async () => {
    openReports();
    await choose("2026-04-01", "2026-04-01");

    expect(await screen.findByText("No report could be read for that period.")).toBeInTheDocument();
    expect(callsTo("accounting_report_read")[0][2]).toEqual({ period_start: "2026-04-01T00:00:00Z", period_end: "2026-04-02T00:00:00Z" });
  });

  it("refuses an empty period in words and makes no call", async () => {
    openReports();
    await choose("2026-04-01", "");

    expect(await screen.findByText("Choose both a start date and an end date.")).toBeInTheDocument();
    expect(callsTo("accounting_report_read")).toHaveLength(0);
  });

  it("says so in words when no budget lines were set for the period", async () => {
    openReports();
    await choose("2027-01-01", "2027-03-31");

    expect(await screen.findByText("No report could be read for that period.")).toBeInTheDocument();
  });
});
