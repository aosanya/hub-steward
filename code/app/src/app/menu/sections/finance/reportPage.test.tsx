import { vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { carriedChatAbout, carryChatAbout, forgetChatAbout } from "../../../chatAbout";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { ReportsScreen } from "./ReportsScreen";
import { UpwardReportScreen } from "./UpwardReportScreen";

let permissions: string[];

const report = { name: "First quarter", period_start: "2026-01-01", period_end: "2026-04-01" };

const figures = {
  planned: 12000,
  spent: 9500,
  difference: 2500,
  departments: [{ department: "Public works", planned: 7000, spent: 5000, difference: 2000 }],
  balances: [],
};

const lines = [{ id: "b1", name: "Road repair", department: "Public works", planned: 7000, spent: 5000 }];

const answer = async (name: string) => {
  if (name === "accounting_report_list") return { items: [report] };
  if (name === "accounting_report_read") return { ...report, figures, lines };
  if (name === "accounting_upward_report_list") return { items: [] };
  if (name === "agency_get_my_roles") return { permissions };
  return { items: [] };
};

const setWide = (wide: boolean) => {
  window.matchMedia = ((query: string) => ({ matches: wide, media: query, addEventListener: () => undefined, removeEventListener: () => undefined })) as unknown as typeof window.matchMedia;
};

beforeEach(() => {
  openAgency("town");
  permissions = ["accounting.manage", "accounting.view"];
  setWide(true);
  vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name) => answer(name));
});

afterEach(() => {
  cleanup();
  forgetChatAbout();
  forgetOpenAgency();
  vi.restoreAllMocks();
  Reflect.deleteProperty(window, "matchMedia");
});

const openReport = async () => {
  render(
    <MemoryRouter initialEntries={["/a/town/menu/finance/reports"]}>
      <Routes>
        <Route path="/a/:agencyId/menu/finance/reports" element={<ReportsScreen />} />
        <Route path="*" element={null} />
      </Routes>
    </MemoryRouter>,
  );
  await userEvent.click(await screen.findByRole("button", { name: /First quarter/ }));
  return within(document.querySelector(".wf-main .wf-content") as HTMLElement);
};

const openNational = () =>
  render(
    <MemoryRouter initialEntries={["/a/town/menu/finance/national-report"]}>
      <Routes>
        <Route path="/a/:agencyId/menu/finance/national-report" element={<UpwardReportScreen />} />
        <Route path="*" element={null} />
      </Routes>
    </MemoryRouter>,
  );

describe("a financial report is built like a resident", () => {
  it("titles the page with the report, puts its period on one quiet line and draws no band", async () => {
    const pane = await openReport();
    expect(await pane.findByRole("heading", { level: 1, name: "First quarter" })).toBeInTheDocument();
    expect(document.querySelector(".quiet-line")?.textContent).toContain("2026");
    expect(document.querySelector(".wf-head")).toBeNull();
  });

  it("holds Planned, Spent and Difference as rows of one Report card", async () => {
    const pane = await openReport();
    const card = within(await pane.findByRole("region", { name: "Report" }));
    for (const label of ["Planned", "Spent", "Difference"]) expect(card.getByText(label)).toBeInTheDocument();
  });

  it("lists the departments as rows of a Departments card", async () => {
    const pane = await openReport();
    const card = within(await pane.findByRole("region", { name: "Departments" }));
    expect(card.getByText("Public works")).toBeInTheDocument();
  });

  it("carries the report to the chat, named by its period", async () => {
    const pane = await openReport();
    await pane.findByRole("region", { name: "Report" });
    carryChatAbout();
    expect(carriedChatAbout()).toMatchObject({ kind: "report", id: "2026-01-01~2026-04-01", name: "First quarter" });
  });
});

describe("the choose period form is a card", () => {
  it("puts Read report in the footer of a Choose period card", async () => {
    await openReport();
    const card = within(await screen.findByRole("region", { name: "Choose period" }));
    expect(card.getByRole("button", { name: "Read report" }).closest("footer")).not.toBeNull();
  });
});

describe("the national report is built like a resident", () => {
  it("draws a Report to send card with Show figures in its footer and no loose Send report button", async () => {
    openNational();
    const card = within(await screen.findByRole("region", { name: "Report to send" }));
    expect(card.getByRole("button", { name: "Show figures" }).closest("footer")).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Send report" })).toBeNull();
    expect(document.querySelector(".wf-head")).toBeNull();
  });

  it("offers Send to national level in the Actions dropdown to a reader with accounting.manage", async () => {
    openNational();
    await userEvent.click(await screen.findByRole("button", { name: "Actions" }));
    expect(screen.getByRole("button", { name: "Send to national level" })).toBeInTheDocument();
  });

  it("shows no Actions dropdown to a reader without accounting.manage", async () => {
    permissions = ["accounting.view"];
    openNational();
    await screen.findByRole("region", { name: "Report to send" });
    expect(screen.queryByRole("button", { name: "Actions" })).toBeNull();
  });
});

describe("the national report is one column with a title, a form and a Sent card", () => {
  it("names the page and says nothing has been sent in its quiet line", async () => {
    openNational();
    await screen.findByRole("region", { name: "Report to send" });
    expect(document.querySelector(".person-name")?.textContent).toBe("National Report");
    expect(await screen.findByText("Nothing has been sent yet", { selector: ".quiet-line" })).toBeInTheDocument();
  });

  it("holds an empty Sent card inside the page and no list pane or Home button", async () => {
    openNational();
    const sent = within(await screen.findByRole("region", { name: "Sent reports" }));
    expect(await sent.findByText("Nothing has been sent yet.")).toBeInTheDocument();
    expect(sent.queryByRole("button", { name: "Home" })).toBeNull();
    expect(document.querySelector(".mw-list")).toBeNull();
    expect(document.querySelector(".wf-panes")).toBeNull();
  });

  it("draws the shown figures as a Report card in the same column", async () => {
    openNational();
    const form = within(await screen.findByRole("region", { name: "Report to send" }));
    await userEvent.type(form.getByLabelText("From"), "2026-01-01");
    await userEvent.type(form.getByLabelText("To"), "2026-03-31");
    await userEvent.click(form.getByRole("button", { name: "Show figures" }));
    const figuresCard = within(await screen.findByRole("region", { name: "Report" }));
    expect(await figuresCard.findByText("Planned")).toBeInTheDocument();
    expect(document.querySelector(".wf-panes")).toBeNull();
  });
});

describe("the report page carries its acts in the Actions dropdown at the top left", () => {
  it("has no Send to a person bar and no act in the footer of the Report card", async () => {
    permissions = [...permissions, "notification.raise"];
    await openReport();
    const card = within(await screen.findByRole("region", { name: "Report" }));
    expect(card.queryByRole("button", { name: "Send to a person" })).toBeNull();
    expect(card.queryByRole("button", { name: "Share" })).toBeNull();
    expect(document.querySelector(".person-page footer.sec-foot")).toBeNull();
  });
});
