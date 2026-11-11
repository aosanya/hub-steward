import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../i18n";
import { ConsoleCtx, type ConsoleContext } from "../shell/context";
import type { PageRow } from "../types";
import { McpError, callTool } from "../wakala/mcp";
import { ApprovalsPage } from "./ApprovalsPage";

vi.mock("../wakala/mcp", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../wakala/mcp")>()),
  callTool: vi.fn(),
}));

const words = {
  en: {
    "menu.approvals": "Approvals",
    approvalsPending: "Pending",
    approvalsApproved: "Approved",
    approvalsDeclined: "Declined",
    approvalsRequest: "Request",
    approvalsKind: "Kind",
    approvalsAskedBy: "Asked by",
    approvalsAsked: "Asked",
    approvalsWho: "Who",
    approvalsWhat: "What",
    approvalsWhy: "Why",
    approvalsPendingApproval: "Pending approval",
    approvalsWorkflow: "Workflow",
    approvalsDraftedBy: "Drafted by",
    approvalsApprovedBy: "Approved by",
    approvalsDeclinedBy: "Declined by",
    approvalsReason: "Reason",
    approvalsLog: "Log",
    approvalsLogBy: "By",
    approvalsLogStep: "Step",
    approvalsLogDrafted: "Drafted the request",
    approvalsLogAmended: "Changed the request",
    approvalsLogApproved: "Approved the request",
    approvalsLogDeclined: "Declined the request",
    approvalsAllLink: "Approve all of {name}'s",
    approvalsAllTitle: "Approve all {n} of {name}'s requests",
    approvalsAllText: "Each request is decided in turn and logged.",
    approvalsAllButton: "Approve all",
    approvalsAllDone: "Approved all of {name}'s requests",
    approvalsChangedSinceRead: "This request changed after you opened it. Read it again, then decide.",
    cancel: "Cancel",
    colTime: "Time",
    "chat.colTool": "Tool",
    retry: "Try again",
    status: "Status",
    approve: "Approve",
    decline: "Decline",
    submitFailed: "The change could not be sent.",
    loadFailed: "The page could not be loaded.",
    noRows: "Nothing here yet.",
  },
};

const wifi: PageRow = {
  id: "a1",
  summary: "Wi-Fi account for Achieng",
  kind: "access",
  proposed_by: "Hub Steward",
  proposed_at: "2026-10-26 09:12",
  status: "pending",
};
const seat: PageRow = {
  id: "a2",
  summary: "Seat 4 for Otieno",
  kind: "booking",
  proposed_by: "Hub Steward",
  proposed_at: "2026-10-26 09:40",
  status: "pending",
};

type Call = { hub: string; tool: string; args: Record<string, unknown> };
type Backend = {
  rows?: Record<string, PageRow[]>;
  rowsFailure?: Error;
  decideFailure?: Error;
  onDecide?: (args: Record<string, unknown>) => void;
};

const listed = (status: string): Call => ({ hub: "h1", tool: "agency_list_approvals", args: { status } });
const decided = (approvalId: string, decision: string): Call => ({
  hub: "h1",
  tool: "agency_decide_approval",
  args: { approval_id: approvalId, decision },
});
const listings = (calls: Call[]) => calls.filter((c) => c.tool === "agency_list_approvals");
const decisions = (calls: Call[]) => calls.filter((c) => c.tool === "agency_decide_approval");

function startBackend(backend: Backend = {}) {
  const calls: Call[] = [];
  vi.mocked(callTool).mockImplementation(async (hubId, tool, args = {}) => {
    calls.push({ hub: hubId, tool, args });
    if (tool === "agency_decide_approval") {
      if (backend.decideFailure) throw backend.decideFailure;
      backend.onDecide?.(args);
      return {} as never;
    }
    if (tool === "agency_list_approvals") {
      if (backend.rowsFailure) throw backend.rowsFailure;
      const everyRow = Object.values(backend.rows ?? {}).flat();
      return { items: args.status === undefined ? everyRow : (backend.rows?.[String(args.status)] ?? []) } as never;
    }
    throw new Error("unexpected " + tool);
  });
  return calls;
}

function renderApprovals(path: string) {
  const refreshMenu = vi.fn();
  const value: ConsoleContext = {
    hub: { id: "h1", name: "Siaya hub", role: "Hub Steward", model_key_set: true },
    page: "approvals",
    setBadges: () => {},
    refreshMenu,
  };
  render(
    <I18nProvider initial={words}>
      <MemoryRouter initialEntries={[path]}>
        <ConsoleCtx.Provider value={value}>
          <Routes>
            <Route path="/h/:hubId/approvals/:tab" element={<ApprovalsPage />} />
          </Routes>
        </ConsoleCtx.Provider>
      </MemoryRouter>
    </I18nProvider>,
  );
  return { refreshMenu };
}

const tabLink = (name: string) => within(screen.getByRole("navigation")).getByRole("link", { name });

afterEach(() => {
  vi.mocked(callTool).mockReset();
});

describe("the approvals page", () => {
  it("shows the Approvals title and the Pending, Approved and Declined tabs with the open one marked", async () => {
    startBackend({ rows: { pending: [wifi] } });
    renderApprovals("/h/h1/approvals/pending");
    expect(screen.getByRole("heading", { name: "Approvals" })).toBeInTheDocument();
    const links = within(screen.getByRole("navigation")).getAllByRole("link");
    expect(links.map((l) => l.textContent)).toEqual(["Pending", "Approved", "Declined"]);
    expect(tabLink("Pending")).toHaveAttribute("aria-current", "page");
    expect(tabLink("Approved")).not.toHaveAttribute("aria-current");
    expect(tabLink("Declined")).not.toHaveAttribute("aria-current");
    await screen.findByRole("table");
  });

  it("links each tab to the approvals page of the same hub", async () => {
    startBackend({ rows: { pending: [wifi] } });
    renderApprovals("/h/h1/approvals/pending");
    expect(tabLink("Pending")).toHaveAttribute("href", "/h/h1/approvals/pending");
    expect(tabLink("Approved")).toHaveAttribute("href", "/h/h1/approvals/approved");
    expect(tabLink("Declined")).toHaveAttribute("href", "/h/h1/approvals/declined");
    await screen.findByRole("table");
  });

  it("asks the hub's agency for the pending requests and lists them under the Who, What and Why headings", async () => {
    const calls = startBackend({ rows: { pending: [wifi, seat] } });
    renderApprovals("/h/h1/approvals/pending");
    const table = await screen.findByRole("table");
    expect(calls).toEqual([listed("pending")]);
    const headings = within(table).getAllByRole("columnheader").map((h) => h.textContent);
    expect(headings).toEqual(["Who", "What", "Why", ""]);
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText("Wi-Fi account for Achieng")).toBeInTheDocument();
    expect(within(rows[0]).getByText(/Access/)).toBeInTheDocument();
    expect(within(rows[0]).getByText("Pending approval")).toBeInTheDocument();
    expect(within(rows[0]).getByText(/09:12/)).toBeInTheDocument();
    expect(within(rows[1]).getByText("Seat 4 for Otieno")).toBeInTheDocument();
  });

  it("names the member from the request's payload, links to Users and shows the one who drafted it and the language", async () => {
    const akinyi: PageRow = {
      ...wifi,
      payload: JSON.stringify({ name: "Akinyi Otieno", language: "Kiswahili" }),
    };
    startBackend({ rows: { pending: [akinyi] } });
    renderApprovals("/h/h1/approvals/pending");
    const table = await screen.findByRole("table");
    const row = within(table).getAllByRole("row")[1];
    expect(within(row).getByRole("link", { name: "Akinyi Otieno" })).toHaveAttribute("href", "/h/h1/users");
    expect(within(row).getByText("AO")).toBeInTheDocument();
    expect(within(row).getByText("Hub Steward")).toBeInTheDocument();
    expect(within(row).getByText("Kiswahili")).toBeInTheDocument();
  });

  it("falls back to the one who drafted the request when it names nobody, without a link to Users", async () => {
    startBackend({ rows: { pending: [wifi] } });
    renderApprovals("/h/h1/approvals/pending");
    const table = await screen.findByRole("table");
    const row = within(table).getAllByRole("row")[1];
    expect(within(row).getAllByText("Hub Steward")).toHaveLength(2);
    expect(within(row).queryByRole("link", { name: "Hub Steward" })).not.toBeInTheDocument();
  });

  it("leaves the Who and Why cells empty when the row has nothing for them", async () => {
    startBackend({ rows: { pending: [{ id: "a3", summary: "Laptop for Juma" }] } });
    renderApprovals("/h/h1/approvals/pending");
    const table = await screen.findByRole("table");
    const cells = within(within(table).getAllByRole("row")[1]).getAllByRole("cell");
    expect(cells[0].textContent).toBe("");
    expect(cells[1]).toHaveTextContent("Laptop for Juma");
    expect(cells[2].textContent).toBe("");
  });

  it("counts the pending requests on the Pending tab once they are listed", async () => {
    startBackend({ rows: { pending: [wifi, seat] } });
    renderApprovals("/h/h1/approvals/pending");
    await screen.findByRole("table");
    expect(tabLink("Pending 2")).toHaveAttribute("aria-current", "page");
  });

  it("links each request's summary to its detail", async () => {
    startBackend({ rows: { pending: [wifi] } });
    renderApprovals("/h/h1/approvals/pending");
    await screen.findByRole("table");
    expect(screen.getByRole("link", { name: "Wi-Fi account for Achieng" })).toHaveAttribute("href", "/h/h1/approvals/pending?request=a1");
  });

  it("puts an Approve and a Decline button on every pending row", async () => {
    startBackend({ rows: { pending: [wifi, seat] } });
    renderApprovals("/h/h1/approvals/pending");
    await screen.findByRole("table");
    expect(screen.getAllByRole("button", { name: "Approve" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Decline" })).toHaveLength(2);
  });

  it("sends approved for the row's id when Approve is pressed, then shows the rows again and refreshes the menu", async () => {
    const pending = [wifi, seat];
    const calls = startBackend({
      rows: { pending },
      onDecide: (args) => pending.splice(0, pending.length, ...pending.filter((r) => r.id !== args.approval_id)),
    });
    const { refreshMenu } = renderApprovals("/h/h1/approvals/pending");
    await screen.findByText("Wi-Fi account for Achieng");
    await userEvent.click(within(screen.getAllByRole("row")[1]).getByRole("button", { name: "Approve" }));
    await waitFor(() => expect(screen.queryByText("Wi-Fi account for Achieng")).not.toBeInTheDocument());
    expect(screen.getByText("Seat 4 for Otieno")).toBeInTheDocument();
    expect(calls).toEqual([listed("pending"), decided("a1", "approved"), listed("pending")]);
    expect(refreshMenu).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("sends refused for the row's id when Decline is pressed", async () => {
    const calls = startBackend({ rows: { pending: [wifi, seat] } });
    renderApprovals("/h/h1/approvals/pending");
    await screen.findByText("Seat 4 for Otieno");
    await userEvent.click(within(screen.getAllByRole("row")[2]).getByRole("button", { name: "Decline" }));
    await waitFor(() => expect(listings(calls)).toHaveLength(2));
    expect(decisions(calls)).toEqual([decided("a2", "refused")]);
  });

  it("says the change could not be sent, keeps the rows and does not reload when the agency refuses the decision", async () => {
    const calls = startBackend({ rows: { pending: [wifi] }, decideFailure: new McpError("agency_decide_approval: already decided") });
    const { refreshMenu } = renderApprovals("/h/h1/approvals/pending");
    await screen.findByText("Wi-Fi account for Achieng");
    await userEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("The change could not be sent.");
    expect(screen.getByText("Wi-Fi account for Achieng")).toBeInTheDocument();
    expect(listings(calls)).toHaveLength(1);
    expect(refreshMenu).not.toHaveBeenCalled();
  });

  it("sends the amendment count of the row the approver is looking at", async () => {
    const amended: PageRow = { ...wifi, amendments: JSON.stringify([{ by: "agent" }, { by: "agent" }]) };
    const calls = startBackend({ rows: { pending: [amended] } });
    renderApprovals("/h/h1/approvals/pending");
    await screen.findByText("Wi-Fi account for Achieng");
    await userEvent.click(screen.getByRole("button", { name: "Approve" }));
    await waitFor(() => expect(decisions(calls)).toHaveLength(1));
    expect(decisions(calls)[0].args).toEqual({ approval_id: "a1", decision: "approved", seen_amendments: 2 });
  });

  it("tells the approver to read the request again and lists it afresh when it changed after it was read", async () => {
    const changed = new McpError("agency_decide_approval: the approval changed after it was read, so read it again before deciding");
    const calls = startBackend({ rows: { pending: [wifi] }, decideFailure: changed });
    const { refreshMenu } = renderApprovals("/h/h1/approvals/pending");
    await screen.findByText("Wi-Fi account for Achieng");
    await userEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("This request changed after you opened it. Read it again, then decide.");
    await waitFor(() => expect(listings(calls)).toHaveLength(2));
    expect(screen.getByText("Wi-Fi account for Achieng")).toBeInTheDocument();
    expect(refreshMenu).not.toHaveBeenCalled();
  });

  it("says the change could not be sent when the agency cannot be reached for the decision", async () => {
    startBackend({ rows: { pending: [wifi] }, decideFailure: new TypeError("network down") });
    renderApprovals("/h/h1/approvals/pending");
    await screen.findByText("Wi-Fi account for Achieng");
    await userEvent.click(screen.getByRole("button", { name: "Decline" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("The change could not be sent.");
  });

  it("takes the failure line away once a later decision goes through", async () => {
    const pending = [wifi, seat];
    const backend: Backend = { rows: { pending }, decideFailure: new McpError("agency_decide_approval: down") };
    startBackend(backend);
    renderApprovals("/h/h1/approvals/pending");
    await screen.findByText("Wi-Fi account for Achieng");
    await userEvent.click(screen.getAllByRole("button", { name: "Approve" })[0]);
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    backend.decideFailure = undefined;
    await userEvent.click(screen.getAllByRole("button", { name: "Approve" })[0]);
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  });

  it("lists the approved requests without Approve and Decline buttons", async () => {
    const calls = startBackend({ rows: { approved: [{ ...wifi, status: "approved" }] } });
    renderApprovals("/h/h1/approvals/approved");
    await screen.findByText("Wi-Fi account for Achieng");
    expect(calls).toEqual([listed("approved")]);
    expect(tabLink("Approved")).toHaveAttribute("aria-current", "page");
    expect(within(screen.getByRole("table")).getByText("Approved")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("lists the declined requests without Approve and Decline buttons", async () => {
    const calls = startBackend({ rows: { refused: [{ ...seat, status: "refused" }] } });
    renderApprovals("/h/h1/approvals/declined");
    await screen.findByText("Seat 4 for Otieno");
    expect(calls).toEqual([listed("refused")]);
    expect(tabLink("Declined")).toHaveAttribute("aria-current", "page");
    expect(within(screen.getByRole("table")).getByText("Declined")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("treats a tab it does not know as the pending tab", async () => {
    const calls = startBackend({ rows: { pending: [wifi] } });
    renderApprovals("/h/h1/approvals/archived");
    await screen.findByText("Wi-Fi account for Achieng");
    expect(calls).toEqual([listed("pending")]);
    expect(tabLink("Pending 1")).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Approve" })).toBeInTheDocument();
  });

  it("loads the other tab's requests when a tab is pressed", async () => {
    const calls = startBackend({ rows: { pending: [wifi], refused: [{ ...seat, status: "refused" }] } });
    renderApprovals("/h/h1/approvals/pending");
    await screen.findByText("Wi-Fi account for Achieng");
    await userEvent.click(tabLink("Declined"));
    expect(await screen.findByText("Seat 4 for Otieno")).toBeInTheDocument();
    expect(screen.queryByText("Wi-Fi account for Achieng")).not.toBeInTheDocument();
    expect(calls).toEqual([listed("pending"), listed("refused")]);
    expect(tabLink("Declined")).toHaveAttribute("aria-current", "page");
  });

  it("says there is nothing here yet when the tab has no requests", async () => {
    startBackend({ rows: { pending: [] } });
    renderApprovals("/h/h1/approvals/pending");
    expect(await screen.findByText("Nothing here yet.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("says the page could not be loaded when the agency answers with a failure", async () => {
    startBackend({ rowsFailure: new McpError("agency_list_approvals: down") });
    renderApprovals("/h/h1/approvals/pending");
    expect(await screen.findByRole("alert")).toHaveTextContent("The page could not be loaded.");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Approvals" })).toBeInTheDocument();
  });

  it("asks again for the requests when Try again is pressed after the page could not be loaded", async () => {
    const backend: Backend = { rows: { pending: [wifi] }, rowsFailure: new McpError("agency_list_approvals: down") };
    const calls = startBackend(backend);
    renderApprovals("/h/h1/approvals/pending");
    await screen.findByRole("alert");
    backend.rowsFailure = undefined;
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Wi-Fi account for Achieng")).toBeInTheDocument();
    expect(listings(calls)).toHaveLength(2);
  });

  it("says the page could not be loaded when the agency cannot be reached", async () => {
    startBackend({ rowsFailure: new TypeError("network down") });
    renderApprovals("/h/h1/approvals/pending");
    expect(await screen.findByText("The page could not be loaded.")).toBeInTheDocument();
  });
});

describe("a request's detail", () => {
  const decidedRequest: PageRow = {
    ...wifi,
    status: "approved",
    decided_by: "Lab manager",
    decided_at: "2026-10-26T10:42:00",
    payload: JSON.stringify({ name: "Akinyi Otieno" }),
    proposed_at: "2026-10-26T09:20:00",
  };

  it("shows the request's summary, its state, who asked, who drafted it and who approved it", async () => {
    const calls = startBackend({ rows: { approved: [decidedRequest] } });
    renderApprovals("/h/h1/approvals/pending?request=a1");
    expect(await screen.findByRole("heading", { name: "Wi-Fi account for Achieng" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Access" })).toBeInTheDocument();
    expect(calls).toEqual([{ hub: "h1", tool: "agency_list_approvals", args: {} }]);
    const facts = screen.getByText("Workflow").closest("dl")!;
    expect(within(facts).getByText("Approved")).toBeInTheDocument();
    expect(within(facts).getByText("Akinyi Otieno")).toBeInTheDocument();
    expect(within(facts).getByText(/Hub Steward · /)).toBeInTheDocument();
    expect(within(facts).getByText("Approved by")).toBeInTheDocument();
    expect(within(facts).getByText(/Lab manager · /)).toBeInTheDocument();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("says who declined it and why for a declined request", async () => {
    startBackend({ rows: { refused: [{ ...seat, status: "refused", decided_by: "Lab manager", reason: "No seat that day" }] } });
    renderApprovals("/h/h1/approvals/pending?request=a2");
    expect(await screen.findByText("Declined by")).toBeInTheDocument();
    expect(screen.getByText("No seat that day")).toBeInTheDocument();
  });

  it("says there is nothing here when the request is not among the hub's requests", async () => {
    startBackend({ rows: { pending: [wifi] } });
    renderApprovals("/h/h1/approvals/pending?request=gone");
    expect(await screen.findByText("Nothing here yet.")).toBeInTheDocument();
  });

  it("says the page could not be loaded when the agency fails", async () => {
    startBackend({ rowsFailure: new McpError("agency_list_approvals: down") });
    renderApprovals("/h/h1/approvals/pending?request=a1");
    expect(await screen.findByRole("alert")).toHaveTextContent("The page could not be loaded.");
  });
});

describe("the request's log", () => {
  const amended = {
    ...wifi,
    status: "approved",
    decided_by: "Lab manager",
    decided_at: "2026-10-26T10:42:00",
    proposed_at: "2026-10-26T09:20:00",
    amendments: JSON.stringify([{ at: "2026-10-26T09:50:00", by: "Hub Steward", summary: "Seat 5" }]),
  };

  it("lists the draft, each change and the decision with who did it and the tool behind it", async () => {
    startBackend({ rows: { approved: [amended] } });
    renderApprovals("/h/h1/approvals/pending?request=a1");
    await screen.findByRole("heading", { name: "Log" });
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("columnheader").map((c) => c.textContent)).toEqual(["Time", "By", "Step", "Tool"]);
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows.map((r) => within(r).getAllByRole("cell").map((c) => c.textContent).slice(1))).toEqual([
      ["Hub Steward", "Drafted the request", "agency_propose_write"],
      ["Hub Steward", "Changed the request", "agency_amend_approval"],
      ["Lab manager", "Approved the request", "agency_decide_approval"],
    ]);
  });

  it("lists the steps taken after approving below the decision, in the words the request carries and with no tool", async () => {
    const carriedOut = {
      ...amended,
      applied: JSON.stringify([
        { at: "2026-10-26T10:42:09", by: "Lab manager", step: "Created the role \"Lab host\" in the open draft" },
        { at: "2026-10-26T10:42:10", by: "Lab manager", step: "Created the goal \"Open the lab\" in the open draft" },
      ]),
    };
    startBackend({ rows: { approved: [carriedOut] } });
    renderApprovals("/h/h1/approvals/pending?request=a1");
    await screen.findByRole("heading", { name: "Log" });
    const rows = within(screen.getByRole("table")).getAllByRole("row").slice(1);
    expect(rows.map((r) => within(r).getAllByRole("cell").map((c) => c.textContent).slice(1))).toEqual([
      ["Hub Steward", "Drafted the request", "agency_propose_write"],
      ["Hub Steward", "Changed the request", "agency_amend_approval"],
      ["Lab manager", "Approved the request", "agency_decide_approval"],
      ["Lab manager", "Created the role \"Lab host\" in the open draft", ""],
      ["Lab manager", "Created the goal \"Open the lab\" in the open draft", ""],
    ]);
  });

  it("shows no steps taken for a request that was never carried out", async () => {
    startBackend({ rows: { approved: [{ ...amended, applied: "" }] } });
    renderApprovals("/h/h1/approvals/pending?request=a1");
    await screen.findByRole("heading", { name: "Log" });
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(4);
  });

  it("logs a refusal as declined", async () => {
    startBackend({ rows: { refused: [{ ...wifi, status: "refused", decided_by: "Lab manager", decided_at: "2026-10-26T10:42:00" }] } });
    renderApprovals("/h/h1/approvals/pending?request=a1");
    expect(await screen.findByText("Declined the request")).toBeInTheDocument();
  });
});

describe("Approve all for one requester", () => {
  const akinyi = (id: string, summary: string): PageRow => ({
    ...wifi,
    id,
    summary,
    payload: JSON.stringify({ name: "Akinyi Otieno" }),
  });
  const first = akinyi("k1", "Wi-Fi for Akinyi");
  const second = akinyi("k2", "Seat for Akinyi");
  const other: PageRow = { ...seat, id: "o1", payload: JSON.stringify({ name: "Otieno" }) };

  it("offers the link only for a member with more than one pending request", async () => {
    startBackend({ rows: { pending: [first, second, other] } });
    renderApprovals("/h/h1/approvals/pending");
    const link = await screen.findAllByRole("link", { name: "Approve all of Akinyi Otieno's" });
    expect(link).toHaveLength(2);
    expect(link[0]).toHaveAttribute("href", "/h/h1/approvals/pending?requester=Akinyi%20Otieno");
    expect(screen.queryByRole("link", { name: /Approve all of Otieno/ })).not.toBeInTheDocument();
  });

  it("shows only that member's requests under the card and decides each in turn on Approve all", async () => {
    const calls = startBackend({ rows: { pending: [first, second, other] } });
    renderApprovals("/h/h1/approvals/pending?requester=Akinyi%20Otieno");
    expect(await screen.findByText("Approve all 2 of Akinyi Otieno's requests")).toBeInTheDocument();
    expect(screen.getByText("Wi-Fi for Akinyi")).toBeInTheDocument();
    expect(screen.queryByText("Seat 4 for Otieno")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Approve all" }));
    await waitFor(() => expect(decisions(calls)).toHaveLength(2));
    expect(decisions(calls).map((c) => c.args)).toEqual([
      { approval_id: "k1", decision: "approved" },
      { approval_id: "k2", decision: "approved" },
    ]);
    expect(await screen.findByText("Approved all of Akinyi Otieno's requests")).toBeInTheDocument();
  });

  it("says the change could not be sent when one request fails", async () => {
    startBackend({ rows: { pending: [first, second] }, decideFailure: new McpError("agency_decide_approval: down") });
    renderApprovals("/h/h1/approvals/pending?requester=Akinyi%20Otieno");
    await userEvent.click(await screen.findByRole("button", { name: "Approve all" }));
    expect(await screen.findByText("The change could not be sent.")).toBeInTheDocument();
  });
});
