import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { ReportsScreen } from "./ReportsScreen";

type Args = Record<string, unknown> | undefined;

const origin = { path: "/a/town/menu/finance", title: "Finance" };

const reports = [{ name: "Second quarter", period_start: "2026-04-01", period_end: "2026-07-01" }];

const figures = {
  planned: 8000,
  spent: 8300,
  difference: -300,
  departments: [{ department: "Transport", planned: 8000, spent: 8300, difference: -300 }],
  balances: [],
};

const people = [
  { id: "a1", display_name: "Kiss Ágnes" },
  { id: "a2", display_name: "Varga Mária" },
];

let permissions: string[];
let called: MockInstance<typeof mcp.callTool>;

const raises = () => called.mock.calls.filter(([, tool]) => tool === "comm_notification_raise");

const openSecondQuarter = async () => {
  render(
    <MemoryRouter initialEntries={[{ pathname: "/a/town/menu/finance/reports", state: { from: origin } }]}>
      <Routes>
        <Route path="/a/:agencyId/menu/finance/reports" element={<ReportsScreen />} />
        <Route path="*" element={null} />
      </Routes>
    </MemoryRouter>,
  );
  await userEvent.click(await screen.findByRole("button", { name: /Second quarter/ }));
  await waitFor(() => expect(document.querySelector(".mw-detail")?.textContent).toContain("8,300"));
};

beforeEach(() => {
  openAgency("town");
  permissions = ["notification.raise"];
  called = vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => {
    if (name === "accounting_report_list") return { items: reports };
    if (name === "accounting_report_read") return { ...reports[0], figures, lines: [], period: (args as Args)?.period_start };
    if (name === "agency_get_my_roles") return { permissions };
    if (name === "actor_list_actors") return { items: people };
    if (name === "comm_notification_raise") return {};
    throw new Error(`${name} is not a tool this screen may use`);
  });
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

describe("handing an opened report to a person", () => {
  it("offers Send to a person on an opened report to a caller who may raise a notification", async () => {
    await openSecondQuarter();

    expect(await screen.findByRole("button", { name: "Send to a person" })).toBeInTheDocument();
  });

  it("raises one report_handed_over notification for the chosen person, carrying the report's name, period and figures", async () => {
    await openSecondQuarter();
    await userEvent.click(await screen.findByRole("button", { name: "Send to a person" }));
    await userEvent.click(await screen.findByRole("button", { name: /Person/ }));
    await userEvent.click(screen.getByRole("option", { name: "Varga Mária" }));
    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(raises()).toHaveLength(1));
    expect(raises()[0][2]).toEqual({
      recipient_id: "a2",
      category: "report",
      event: "report_handed_over",
      subject_kind: "report",
      subject_id: "2026-04-01~2026-07-01",
      names: { name: "Second quarter", period: "2026-04-01 to 2026-06-30", planned: "8,000", spent: "8,300", difference: "-300" },
    });
    expect(await screen.findByText("Sent to Varga Mária")).toBeInTheDocument();
  });

  it("does not send until a person is chosen", async () => {
    await openSecondQuarter();
    await userEvent.click(await screen.findByRole("button", { name: "Send to a person" }));

    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
    expect(raises()).toHaveLength(0);
  });

  it("says so when the hub refuses the notification", async () => {
    called.mockImplementation(async (_agency, name) => {
      if (name === "accounting_report_list") return { items: reports };
      if (name === "accounting_report_read") return { ...reports[0], figures, lines: [] };
      if (name === "agency_get_my_roles") return { permissions };
      if (name === "actor_list_actors") return { items: people };
      throw new Error("forbidden");
    });
    await openSecondQuarter();
    await userEvent.click(await screen.findByRole("button", { name: "Send to a person" }));
    await userEvent.click(await screen.findByRole("button", { name: /Person/ }));
    await userEvent.click(screen.getByRole("option", { name: "Kiss Ágnes" }));
    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByText("That did not go through.")).toBeInTheDocument();
  });

  it("shows no Send to a person to a caller who may not raise a notification", async () => {
    permissions = [];
    await openSecondQuarter();

    await waitFor(() => expect(called.mock.calls.some(([, tool]) => tool === "agency_get_my_roles")).toBe(true));
    expect(screen.queryByRole("button", { name: "Send to a person" })).toBeNull();
  });
});
