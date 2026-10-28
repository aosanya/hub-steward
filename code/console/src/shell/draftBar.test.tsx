import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { useEffect, useState, type ReactNode } from "react";
import { Link, MemoryRouter, Navigate, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../i18n";
import { SessionProvider, useSession } from "../session";
import type { Hub } from "../types";
import { McpError, callTool } from "../wakala/mcp";
import { useConsole } from "./context";
import { Frame } from "./Frame";

vi.mock("../wakala/mcp", async (importOriginal) => ({ ...(await importOriginal<object>()), callTool: vi.fn() }));

const callToolMock = vi.mocked(callTool);

const words = JSON.parse(readFileSync(resolve(__dirname, "../../public/i18n.json"), "utf8"));

const lab: Hub = { id: "siaya", name: "Siaya Community Computer Lab", role: "owner", kind: "community computer lab", model_key_set: true };
const farmers: Hub = { id: "kisumu", name: "Kisumu Farmers' Group", role: "owner", kind: "farmers' group", model_key_set: false };

type Backend = {
  approved: { id: string; kind: string; summary: string; decided_at: string }[];
  issues: { id: string; severity: string; message: string; entity_type: string; entity_id: string }[];
  publications: unknown[];
  publishAnswer: () => unknown;
};

const stored: Backend = { approved: [], issues: [], publications: [], publishAnswer: () => ({}) };

const goalApproval = (id: string) => ({ id, kind: "agency_create_goal", summary: "Add the goal " + id, decided_at: "2026-10-27T10:00:00Z" });

const toolsCalled = (tool: string) => callToolMock.mock.calls.filter((call) => call[1] === tool);

function startBackend(over: Partial<Backend> = {}) {
  Object.assign(stored, { approved: [], issues: [], publications: [], publishAnswer: () => ({ version: 1, tag: "v1", published_at: "2026-10-27T11:00:00Z" }), ...over });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) })),
  );
  callToolMock.mockReset();
  callToolMock.mockImplementation(async (_hubId, tool, args = {}) => {
    if (tool === "agency_list_approvals") return { items: args.status === "approved" ? stored.approved : [] } as never;
    if (tool === "agency_list_drafts") return { items: [{ id: "d1", description: "Initial draft", status: "open" }] } as never;
    if (tool === "agency_list_publications") return { items: stored.publications } as never;
    if (tool === "agency_list_issues") return { items: stored.issues } as never;
    if (tool === "agency_publish_agency") {
      const frozen = stored.publishAnswer();
      stored.publications = [...stored.publications, frozen];
      return frozen as never;
    }
    throw new McpError(`unexpected tool ${tool}`);
  });
}

function Seed({ children }: { children: ReactNode }) {
  const { startSession } = useSession();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    startSession([lab, farmers]);
    setReady(true);
  }, [startSession]);
  return ready ? <>{children}</> : null;
}

function PageStub() {
  const { page, refreshMenu } = useConsole();
  return (
    <section>
      <h1>The {page} page</h1>
      <button type="button" onClick={refreshMenu}>
        refresh the menu
      </button>
      <Link to={`/h/siaya/${page === "goals" ? "roles" : "goals"}`}>go to the other page</Link>
      <Link to="/h/siaya/groups">go to groups</Link>
      <Link to="/h/siaya/approvals/pending">go to approvals</Link>
    </section>
  );
}

function openConsole(at: string) {
  return render(
    <MemoryRouter initialEntries={[at]}>
      <I18nProvider initial={words}>
        <SessionProvider>
          <Seed>
            <Routes>
              <Route path="/h/:hubId" element={<Frame />}>
                <Route index element={<Navigate to="status" replace />} />
                <Route path="approvals/:tab" element={<PageStub />} />
                <Route path=":page" element={<PageStub />} />
              </Route>
            </Routes>
          </Seed>
        </SessionProvider>
      </I18nProvider>
    </MemoryRouter>,
  );
}

const main = () => document.querySelector("main") as HTMLElement;
const bar = () => screen.getByRole("region", { name: "Changes not published" });

beforeEach(() => localStorage.setItem("lang", "en"));

afterEach(() => {
  vi.unstubAllGlobals();
  callToolMock.mockReset();
});

describe("the draft bar in the console shell", () => {
  it("shows how many changes are not published above the page of an agency definition", async () => {
    startBackend({ approved: [goalApproval("a2"), goalApproval("a1")] });
    openConsole("/h/siaya/goals");
    await screen.findByRole("heading", { name: "The goals page" });
    expect(await within(main()).findByText("2 changes not published")).toBeInTheDocument();
    expect(within(bar()).getByRole("button", { name: "Publish" })).toBeInTheDocument();
    expect(main().firstElementChild).toContainElement(bar());
  });

  it("shows the bar on the profile, goals, roles and risks pages", async () => {
    startBackend({ approved: [goalApproval("a1")] });
    for (const page of ["profile", "goals", "roles", "bowties", "modules"]) {
      const { unmount } = openConsole(`/h/siaya/${page}`);
      await screen.findByRole("heading", { name: `The ${page} page` });
      expect(await within(main()).findByText("1 change not published")).toBeInTheDocument();
      unmount();
    }
  });

  it("shows no bar on the status, groups, users and approvals pages and asks no draft question there", async () => {
    startBackend({ approved: [goalApproval("a1")] });
    for (const path of ["status", "groups", "users", "approvals/pending"]) {
      const { unmount } = openConsole(`/h/siaya/${path}`);
      await screen.findByRole("heading", { name: `The ${path.split("/")[0]} page` });
      expect(screen.queryByRole("region", { name: "Changes not published" })).not.toBeInTheDocument();
      unmount();
    }
    expect(toolsCalled("agency_list_approvals")).toHaveLength(0);
    expect(toolsCalled("agency_list_drafts")).toHaveLength(0);
    expect(toolsCalled("agency_list_publications")).toHaveLength(0);
  });

  it("shows no bar on the form that adds a goal, where the design draws none", async () => {
    startBackend({ approved: [goalApproval("a1")] });
    openConsole("/h/siaya/goals?add=goal");
    await screen.findByRole("heading", { name: "The goals page" });
    await waitFor(() => expect(toolsCalled("agency_list_drafts")).toHaveLength(1));
    expect(screen.queryByRole("region", { name: "Changes not published" })).not.toBeInTheDocument();
  });

  it("puts the bar between the title of the page and its content", async () => {
    startBackend({ approved: [goalApproval("a1")] });
    openConsole("/h/siaya/goals");
    await within(main()).findByText("1 change not published");
    const slot = bar().closest(".content") as HTMLElement;
    expect(slot).toHaveClass("draft-slot");
    expect(slot.parentElement).toBe(main());
  });

  it("shows no bar while nothing is waiting to be published", async () => {
    startBackend();
    openConsole("/h/siaya/goals");
    await screen.findByRole("heading", { name: "The goals page" });
    await waitFor(() => expect(toolsCalled("agency_list_drafts")).toHaveLength(1));
    expect(screen.queryByRole("region", { name: "Changes not published" })).not.toBeInTheDocument();
  });

  it("asks again and shows the new count when an approval refreshes the menu", async () => {
    const user = userEvent.setup();
    startBackend({ approved: [goalApproval("a1")] });
    openConsole("/h/siaya/goals");
    expect(await within(main()).findByText("1 change not published")).toBeInTheDocument();
    stored.approved = [goalApproval("a2"), goalApproval("a1")];
    await user.click(screen.getByRole("button", { name: "refresh the menu" }));
    expect(await within(main()).findByText("2 changes not published")).toBeInTheDocument();
  });

  it("shows the changes approved elsewhere when the manager comes from the approvals page", async () => {
    const user = userEvent.setup();
    startBackend();
    openConsole("/h/siaya/approvals/pending");
    await screen.findByRole("heading", { name: "The approvals page" });
    stored.approved = [goalApproval("a1")];
    await user.click(screen.getByRole("link", { name: "go to the other page" }));
    expect(await within(main()).findByText("1 change not published")).toBeInTheDocument();
  });

  it("keeps the bar when the manager moves between the agency pages", async () => {
    const user = userEvent.setup();
    startBackend({ approved: [goalApproval("a1")] });
    openConsole("/h/siaya/goals");
    expect(await within(main()).findByText("1 change not published")).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "go to the other page" }));
    await screen.findByRole("heading", { name: "The roles page" });
    expect(await within(main()).findByText("1 change not published")).toBeInTheDocument();
  });

  it("removes the bar when the manager leaves for a page that is not an agency definition", async () => {
    const user = userEvent.setup();
    startBackend({ approved: [goalApproval("a1")] });
    openConsole("/h/siaya/goals");
    expect(await within(main()).findByText("1 change not published")).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "go to groups" }));
    await screen.findByRole("heading", { name: "The groups page" });
    expect(screen.queryByRole("region", { name: "Changes not published" })).not.toBeInTheDocument();
  });

  it("publishes from the bar and then shows the version it became and no count", async () => {
    const user = userEvent.setup();
    startBackend({
      approved: [goalApproval("a1")],
      publishAnswer: () => ({ id: "p4", version: 4, tag: "v4", channel: "production", published_at: "2026-10-27T11:00:00Z", document: {} }),
    });
    openConsole("/h/siaya/goals");
    await within(main()).findByText("1 change not published");
    await user.click(within(bar()).getByRole("button", { name: "Publish" }));
    expect(await within(main()).findByText("Published as version 4")).toBeInTheDocument();
    expect(screen.queryByText("1 change not published")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Publish" })).not.toBeInTheDocument();
    expect(toolsCalled("agency_publish_agency")[0]).toEqual(["siaya", "agency_publish_agency", { draft_id: "d1", channel: "production" }]);
  });

  it("keeps the bar and lists the problems when the scan refuses, then reads Publish again", async () => {
    const user = userEvent.setup();
    startBackend({
      approved: [goalApproval("a1")],
      issues: [{ id: "i1", severity: "error", message: 'Goal G-1 "A" has no Objectives', entity_type: "goal", entity_id: "g1" }],
    });
    openConsole("/h/siaya/goals");
    await within(main()).findByText("1 change not published");
    await user.click(within(bar()).getByRole("button", { name: "Publish" }));
    const card = await screen.findByRole("alert");
    expect(within(card).getByText('Goal G-1 "A" has no Objectives')).toBeInTheDocument();
    expect(within(card).getByRole("link", { name: "Open the goal" })).toHaveAttribute("href", "/h/siaya/goals?goal=g1");
    expect(within(bar()).getByText("1 change not published")).toBeInTheDocument();
    expect(within(bar()).getByRole("button", { name: "Publish again" })).toBeInTheDocument();
    expect(toolsCalled("agency_publish_agency")).toHaveLength(0);
  });

  it("publishes on Publish again once the problem is gone", async () => {
    const user = userEvent.setup();
    startBackend({
      approved: [goalApproval("a1")],
      issues: [{ id: "i1", severity: "error", message: "The Agency has no Goals", entity_type: "agency", entity_id: "" }],
    });
    openConsole("/h/siaya/goals");
    await within(main()).findByText("1 change not published");
    await user.click(within(bar()).getByRole("button", { name: "Publish" }));
    await screen.findByRole("alert");
    stored.issues = [];
    await user.click(within(bar()).getByRole("button", { name: "Publish again" }));
    expect(await within(main()).findByText("Published as version 1")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
