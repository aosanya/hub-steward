import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes } from "react-router-dom";
import { forgetWidth, setWide } from "../../../../features/inbox/fakeWidth";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { routes } from "./index";
import { residentPaths } from "./paths";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

type Row = { id: string; replaces?: string; answers: Record<string, string> };
type Entry = { id: string; at: string; action: string; subject: string; actor: string };

const clerkId = "9b1f7c52-3d40-4e8a-a1c6-7f0e2d5b4a10";
const clerkName = "Sample Clerk";
const newest: Row = { id: "b3", replaces: "b2", answers: { "Trading name": "Malomsor Bakery Ltd", Status: "Active" } };
const middle: Row = { id: "b2", replaces: "b1", answers: { "Trading name": "Malomsor Bakery", Status: "Active" } };
const oldest: Row = { id: "b1", answers: { "Trading name": "Malomsor Bakeri", Status: "Active" } };
const other: Row = { id: "b9", answers: { "Trading name": "Zöldkert Grocer", Status: "Active" } };

const entries: Record<string, Entry[]> = {
  b1: [{ id: "e1", at: "2026-11-01T09:00:00Z", action: "added a row", subject: "b1", actor: clerkId }],
  b2: [{ id: "e2", at: "2026-11-05T10:30:00Z", action: "corrected a row", subject: "b2", actor: clerkId }],
  b3: [{ id: "e3", at: "2026-11-09T14:15:00Z", action: "corrected a row", subject: "b3", actor: clerkId }],
  b9: [{ id: "e9", at: "2026-11-02T08:00:00Z", action: "added a row", subject: "b9", actor: clerkId }],
};

const widths = [
  { name: "a phone page", wide: false, pane: ".mw-detail" },
  { name: "the wide pane", wide: true, pane: ".wf .wf-main .wf-content" },
];

let called: MockInstance<typeof mcp.callTool>;
let auditReply: ((subject: string) => Promise<unknown>) | null;

const answer = async (name: string, args: unknown) => {
  const given = (args ?? {}) as Record<string, unknown>;
  if (name === "agency_list_live_record_rows") return { items: given.history ? [middle, oldest] : [newest, other] };
  if (name === "audit_list_entries") return auditReply ? auditReply(String(given.subject)) : { items: entries[String(given.subject)] ?? [] };
  if (name === "actor_get_actors") return { items: [{ id: clerkId, display_name: clerkName, status: "active" }] };
  return { items: [] };
};

const showScreen = () =>
  render(
    <MemoryRouter initialEntries={[residentPaths.businesses.path()]}>
      <Routes>{routes()}</Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  openAgency("town");
  auditReply = null;
  called = vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => answer(name, args));
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  forgetWidth();
  vi.restoreAllMocks();
});

describe.each(widths)("an opened business on $name", (view) => {
  const open = async (title: string) => {
    setWide(view.wide);
    showScreen();
    await userEvent.click(await screen.findByText(title, { selector: ".ttl" }));
    return () => document.querySelector(view.pane) as HTMLElement;
  };

  it("lists who added and who corrected it, across the older rows it replaced, newest first", async () => {
    const pane = await open("Malomsor Bakery Ltd");

    const heading = await within(pane()).findByRole("heading", { name: "Activity" });
    const rows = await within(pane()).findAllByText(/a row/);
    expect(rows.map((row) => row.textContent)).toEqual(["corrected a row", "corrected a row", "added a row"]);
    expect(within(pane()).getAllByText(new RegExp(clerkName))).toHaveLength(3);
    expect(heading).toBeInTheDocument();
    ["b3", "b2", "b1"].forEach((subject) => expect(called).toHaveBeenCalledWith("", "audit_list_entries", { subject }));
    expect(document.body.textContent).not.toContain(clerkId);
  });

  it("lists only the entries of the opened row's own chain", async () => {
    const pane = await open("Zöldkert Grocer");

    await within(pane()).findByRole("heading", { name: "Activity" });
    expect(await within(pane()).findAllByText(/a row/)).toHaveLength(1);
    const subjects = called.mock.calls.filter((call) => call[1] === "audit_list_entries").map((call) => (call[2] as { subject: string }).subject);
    expect(subjects).toEqual(["b9"]);
  });

  it("shows no Activity heading and no empty card when the row has no entry, and makes nothing up", async () => {
    auditReply = async () => ({ items: [] });
    const pane = await open("Malomsor Bakery Ltd");

    await vi.waitFor(() => expect(called.mock.calls.filter((call) => call[1] === "audit_list_entries").length).toBeGreaterThan(0));
    expect(within(pane()).queryByRole("heading", { name: "Activity" })).toBeNull();
    expect(within(pane()).queryByText(/no activity|nothing/i)).toBeNull();
  });

  it.each([
    ["a refused reply", () => Promise.reject(new mcp.McpError("audit_list_entries: the hub refused this"))],
    ["an unserved tool", () => Promise.reject(new Error("audit_list_entries: unknown tool"))],
  ])("shows no Activity heading, no error and still the record's own fields after %s", async (_label, reply) => {
    auditReply = reply;
    const pane = await open("Malomsor Bakery Ltd");

    await vi.waitFor(() => expect(called.mock.calls.filter((call) => call[1] === "audit_list_entries").length).toBeGreaterThan(0));
    expect(within(pane()).queryByRole("heading", { name: "Activity" })).toBeNull();
    expect(within(pane()).queryByText(/could not be loaded|refused|unknown tool|did not go through/i)).toBeNull();
    expect(within(pane()).getByText("Active")).toBeInTheDocument();
  });
});
