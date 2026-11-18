import { vi, type MockInstance } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { items } from "./index";
import { UpwardReportScreen } from "./UpwardReportScreen";

type Args = Record<string, unknown> | undefined;

type Sent = Record<string, unknown>;

const origin = { path: "/a/town/menu/finance", title: "Finance" };

const earlier: Sent = {
  id: "u1",
  kind: "budget_and_actuals",
  period_start: "2026-01-01T00:00:00Z",
  period_end: "2026-04-01T00:00:00Z",
  planned: 12000,
  spent: 9500,
  difference: 2500,
  sent_at: "2026-04-10T08:30:00Z",
};

const thirdQuarter = { planned: 9000, spent: 8100, difference: 900 };

let landed = "";
let called: MockInstance<typeof mcp.callTool>;
let sent: Sent[];
let permissions: string[];
let sendRefusal: string;
let nextId: number;

const Where = () => {
  landed = useLocation().pathname;
  return null;
};

const callsTo = (name: string) => called.mock.calls.filter(([, tool]) => tool === name);

const formCard = () => screen.getByRole("region", { name: "Report to send" });

const listPane = () => document.querySelector(".person-page") as HTMLElement;

const sentList = () => screen.getByRole("region", { name: "Sent reports" });

const sentRows = () => Array.from(sentList().querySelectorAll("button.row")).map((row) => row.textContent ?? "");

const openScreen = () =>
  render(
    <MemoryRouter initialEntries={[{ pathname: "/a/town/menu/finance/national-report", state: { from: origin } }]}>
      <Routes>
        <Route path="/a/:agencyId/menu/finance/national-report" element={<UpwardReportScreen />} />
        <Route path="*" element={null} />
      </Routes>
      <Where />
    </MemoryRouter>,
  );

const choose = (start: string, end: string) => {
  fireEvent.change(within(formCard()).getByLabelText("From"), { target: { value: start } });
  fireEvent.change(within(formCard()).getByLabelText("To"), { target: { value: end } });
};

const sendNow = async () => {
  await userEvent.click(await screen.findByRole("button", { name: "Actions" }));
  await userEvent.click(screen.getByRole("button", { name: "Send to national level" }));
};

const pickKind = (name: string) => userEvent.click(within(formCard()).getByRole("button", { name }));

beforeEach(() => {
  openAgency("town");
  sent = [earlier];
  permissions = ["accounting.view", "accounting.manage"];
  sendRefusal = "";
  nextId = 2;
  called = vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => {
    if (name === "agency_get_my_roles") return { permissions };
    if (name === "accounting_upward_report_list") return { items: [...sent].reverse() };
    if (name === "accounting_report_read") {
      const start = String((args as Args)?.period_start).slice(0, 10);
      if (start !== "2026-07-01") throw new mcp.McpError("accounting_report_read: no budget lines were set for that period");
      return { name: "Third quarter", figures: thirdQuarter, lines: [] };
    }
    if (name === "accounting_upward_report_send") {
      if (sendRefusal) throw new mcp.McpError(`accounting_upward_report_send: ${sendRefusal}`);
      const record = { id: `u${nextId++}`, ...(args as Sent), ...thirdQuarter, sent_at: "2026-10-05T09:00:00Z", sent_by: "actor-1" };
      sent.push(record);
      return record;
    }
    return { items: [] };
  });
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

describe("the National Report row", () => {
  it("comes after Financial Reports in the Finance items and opens the national report path", () => {
    const titles = items.map((item) => item.title);

    expect(titles.indexOf("National Report")).toBe(titles.indexOf("Financial Reports") + 1);
    expect(items.find((item) => item.title === "National Report")?.path()).toBe("/a/town/menu/finance/national-report");
  });
});

describe("the National Report form", () => {
  it("names the screen, lists both kinds in plain words and starts on budget and actuals", async () => {
    openScreen();

    await screen.findByRole("region", { name: "Report to send" });
    expect(document.querySelector(".person-name")?.textContent).toBe("National Report");
    const budget = within(formCard()).getByRole("button", { name: "Budget and actuals" });
    const spending = within(formCard()).getByRole("button", { name: "Spending by department" });
    expect(budget).toHaveAttribute("aria-pressed", "true");
    expect(spending).toHaveAttribute("aria-pressed", "false");
    expect(formCard().textContent).not.toContain("budget_and_actuals");
    expect(formCard().textContent).not.toContain("spending_by_department");
  });

  it("names Finance on Back and goes there", async () => {
    openScreen();
    await screen.findByRole("region", { name: "Report to send" });

    await userEvent.click(screen.getByRole("button", { name: /Finance/ }));

    await waitFor(() => expect(landed).toBe(origin.path));
  });

  it("reads the figures of the chosen period, sending the typed last day as the next day", async () => {
    openScreen();
    await screen.findByText("Sent reports");
    choose("2026-07-01", "2026-09-30");
    await userEvent.click(within(formCard()).getByRole("button", { name: "Show figures" }));

    await waitFor(() => expect(listPane().textContent).toContain("8,100"));
    expect(callsTo("accounting_report_read")[0][2]).toEqual({ period_start: "2026-07-01T00:00:00Z", period_end: "2026-10-01T00:00:00Z" });
    expect(listPane().textContent).toContain("9,000");
    expect(listPane().textContent).toContain("900");
    expect(within(listPane()).getByText("Planned")).toBeInTheDocument();
    expect(within(listPane()).getByText("Spent")).toBeInTheDocument();
    expect(within(listPane()).getByText("Difference")).toBeInTheDocument();
  });

  it("says so in words when no figures can be read for the period", async () => {
    openScreen();
    await screen.findByText("Sent reports");
    choose("2027-01-01", "2027-03-31");
    await userEvent.click(within(formCard()).getByRole("button", { name: "Show figures" }));

    expect(await within(listPane()).findByText("No report could be read for that period.")).toBeInTheDocument();
  });

  it.each([
    ["a reversed period", "2026-09-30", "2026-07-01", "The end date must not come before the start date."],
    ["a missing end date", "2026-07-01", "", "Choose both a start date and an end date."],
    ["a missing start date", "", "2026-09-30", "Choose both a start date and an end date."],
  ])("refuses %s in words and makes no call, when showing figures", async (_name, start, end, words) => {
    openScreen();
    await screen.findByText("Sent reports");
    choose(start, end);
    await userEvent.click(within(formCard()).getByRole("button", { name: "Show figures" }));

    expect(await screen.findByText(words)).toBeInTheDocument();
    expect(callsTo("accounting_report_read")).toHaveLength(0);
  });

  it.each([
    ["a reversed period", "2026-09-30", "2026-07-01", "The end date must not come before the start date."],
    ["a missing end date", "2026-07-01", "", "Choose both a start date and an end date."],
  ])("refuses %s in words and sends nothing", async (_name, start, end, words) => {
    openScreen();
    await screen.findByText("Sent reports");
    choose(start, end);
    await sendNow();

    expect(await screen.findByText(words)).toBeInTheDocument();
    expect(callsTo("accounting_upward_report_send")).toHaveLength(0);
  });
});

describe("sending a report", () => {
  it("sends the period and the chosen kind, shows the record, and lists it under Sent reports", async () => {
    openScreen();
    await screen.findByText("Sent reports");
    choose("2026-07-01", "2026-09-30");
    await pickKind("Spending by department");
    await sendNow();

    await waitFor(() => expect(callsTo("accounting_upward_report_send")).toHaveLength(1));
    expect(callsTo("accounting_upward_report_send")[0][2]).toEqual({
      period_start: "2026-07-01T00:00:00Z",
      period_end: "2026-10-01T00:00:00Z",
      kind: "spending_by_department",
    });
    await waitFor(() => expect(listPane().textContent).toContain("2026-10-05"));
    expect(listPane().textContent).toContain("8,100");
    await waitFor(() => expect(sentRows()).toHaveLength(2));
    expect(sentRows()[0]).toContain("Spending by department");
    expect(sentRows()[0]).toContain("2026-07-01 to 2026-09-30 · Sent 2026-10-05");
    expect(sentRows()[1]).toContain("Budget and actuals");
  });

  it("sends budget and actuals when the kind was left alone", async () => {
    openScreen();
    await screen.findByText("Sent reports");
    choose("2026-07-01", "2026-09-30");
    await sendNow();

    await waitFor(() => expect(callsTo("accounting_upward_report_send")).toHaveLength(1));
    expect(callsTo("accounting_upward_report_send")[0][2]).toMatchObject({ kind: "budget_and_actuals" });
  });

  it("shows the words of a refusal from the tool as the error on the form and adds no row", async () => {
    sendRefusal = "no budget lines were set for that period";
    openScreen();
    await screen.findByText("Sent reports");
    choose("2027-01-01", "2027-03-31");
    await sendNow();

    expect(await within(formCard()).findByText("no budget lines were set for that period")).toBeInTheDocument();
    expect(sent).toHaveLength(1);
    expect(sentRows()).toHaveLength(1);
  });

  it("does not claim a transmission to a national system", async () => {
    openScreen();
    await screen.findByText("Sent reports");
    choose("2026-07-01", "2026-09-30");
    await sendNow();
    await waitFor(() => expect(listPane().textContent).toContain("2026-10-05"));

    expect(document.body.textContent).not.toMatch(/transmit|delivered|received by|national system/i);
  });
});

describe("the Sent reports list", () => {
  it("draws one row for each record, titled with its kind in words and meta with its period and sent date", async () => {
    openScreen();

    await waitFor(() => expect(sentRows()).toHaveLength(1));
    expect(sentRows()[0]).toContain("Budget and actuals");
    expect(sentRows()[0]).toContain("2026-01-01 to 2026-03-31 · Sent 2026-04-10");
    expect(callsTo("accounting_upward_report_list")).toHaveLength(1);
  });

  it("opens a sent record with its figures as sent", async () => {
    openScreen();
    await waitFor(() => expect(sentRows()).toHaveLength(1));
    await userEvent.click(sentList().querySelector("button.row") as HTMLElement);

    const pane = () => document.querySelector(".person-page") as HTMLElement;
    await waitFor(() => expect(pane()?.textContent).toContain("12,000"));
    expect(pane().textContent).toContain("9,500");
    expect(pane().textContent).toContain("2,500");
    expect(pane().textContent).toContain("2026-04-10");
  });

  it("says so when nothing has been sent yet", async () => {
    sent = [];
    openScreen();

    expect(await screen.findByText("Nothing has been sent yet.")).toBeInTheDocument();
  });

  it("lists the newest send first", async () => {
    sent = [earlier, { ...earlier, id: "u9", kind: "spending_by_department", sent_at: "2026-10-05T09:00:00Z" }];
    openScreen();

    await waitFor(() => expect(sentRows()).toHaveLength(2));
    expect(sentRows()[0]).toContain("Spending by department");
    expect(sentRows()[1]).toContain("Budget and actuals");
  });
});

describe("who may send", () => {
  it("shows Send to national level in the Actions dropdown to someone who holds accounting.manage", async () => {
    openScreen();
    await userEvent.click(await screen.findByRole("button", { name: "Actions" }));

    expect(screen.getByRole("button", { name: "Send to national level" })).toBeInTheDocument();
  });

  it("hides the Actions dropdown from someone who holds accounting.view only, who can still read figures and the list", async () => {
    permissions = ["accounting.view"];
    openScreen();

    await waitFor(() => expect(sentRows()).toHaveLength(1));
    await waitFor(() => expect(callsTo("agency_get_my_roles").length).toBeGreaterThan(0));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.queryByRole("button", { name: "Actions" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Send to national level" })).toBeNull();
    expect(within(formCard()).getByRole("button", { name: "Show figures" })).toBeInTheDocument();
  });
});
