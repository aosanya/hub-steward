import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { AiAgents } from "./AiAgents";
import { items as settingsItems } from "./index";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

const origin = { path: "/a/town/menu/settings", title: "Settings" };

const agents = [
  { id: "r1", name: "Records reader", description: "Reads the register", status: "active", agency_role_id: "seat1", account_id: "a1", tokens_per_day: 50000, tokens_per_month: 900000, requests_per_minute: 12, tokens_per_call: null },
  { id: "r2", name: "Drafting helper", description: "", status: "active", agency_role_id: "seat2", account_id: "a1", tokens_per_day: null },
];

const seats: Record<string, { id: string; name: string; permissions: string[] }> = {
  seat1: { id: "seat1", name: "Register reader seat", permissions: ["resident.view", "bill.view"] },
  seat2: { id: "seat2", name: "Drafting seat", permissions: ["resident.view", "bill.edit"] },
};

const vocabulary = [
  { code: "resident.view", name: "See residents", actions: [], locked: false },
  { code: "bill.view", name: "See bills", actions: [], locked: false },
  { code: "bill.edit", name: "Change bills", actions: [], locked: false },
];

const limits = { tokens_per_person_day: 20000, tokens_per_person_month: 300000, owner_tokens_per_person_day: 100000, owner_tokens_per_person_month: 2000000 };

const breakdown = {
  window: "month",
  rows: [
    { day: "2026-11-17", model: "muse", role_id: "r1", role: "Records reader", kind: "chat", person: "Balogh Anna", tokens_in: 1000, tokens_out: 500, requests: 3 },
    { day: "2026-11-18", model: "muse", role_id: "r1", role: "Records reader", kind: "chat", person: "Kiss Péter", tokens_in: 2000, tokens_out: 500, requests: 2 },
    { day: "2026-11-18", model: "muse", role_id: "r2", role: "Drafting helper", kind: "chat", person: "Kiss Péter", tokens_in: 400, tokens_out: 100, requests: 1 },
  ],
};

const account = { id: "a1", name: "Muse Spark 1.3", tokens_per_day: 200000, tokens_per_month: 4000000, requests_per_minute: 30 };

let called: MockInstance<typeof mcp.callTool>;
let refuse: string[];
let actors: unknown[] | null;
let extraRows: Record<string, unknown>[];

const pane = () => document.querySelector(".mw-detail") as HTMLElement;

const setWide = (wide: boolean) => {
  window.matchMedia = ((query: string) => ({ matches: wide, media: query, addEventListener: () => undefined, removeEventListener: () => undefined })) as unknown as typeof window.matchMedia;
};

beforeEach(() => {
  openAgency("town");
  refuse = [];
  actors = null;
  extraRows = [];
  called = vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => {
    if (refuse.includes(name)) throw new mcp.McpError("not allowed");
    if (name === "ai_list_roles") return { items: agents };
    if (name === "ai_get_assistant_limits") return limits;
    if (name === "ai_usage_breakdown") {
      const wanted = (args as { role_id?: string }).role_id;
      return { ...breakdown, rows: [...breakdown.rows, ...extraRows].filter((row) => !wanted || row.role_id === wanted) };
    }
    if (name === "actor_list_actors" && actors) return { items: actors };
    if (name === "agency_get_role") return seats[(args as { role_id: string }).role_id];
    if (name === "agency_list_permissions") return { items: vocabulary };
    if (name === "ai_get_account") return account;
    throw new Error(`${name} is not a tool this screen may use`);
  });
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  Reflect.deleteProperty(window, "matchMedia");
  vi.restoreAllMocks();
});

const open = (wide = false) => {
  setWide(wide);
  return render(
    <MemoryRouter initialEntries={[{ pathname: "/a/town/menu/settings/ai-agents", state: { from: origin } }]}>
      <Routes>
        <Route path="/a/:agencyId/menu/settings/ai-agents" element={<AiAgents />} />
        <Route path="*" element={null} />
      </Routes>
    </MemoryRouter>,
  );
};

describe("AI agents and limits", () => {
  it("is a row of Settings", () => {
    expect(settingsItems.map((item) => item.title)).toContain("AI Agents & Limits");
  });

  it("lists each person's limit first and then each AI agent by name", async () => {
    open();

    expect(await screen.findByText("Each person")).toBeInTheDocument();
    expect(screen.getByText("Records reader")).toBeInTheDocument();
    expect(screen.getByText("Drafting helper")).toBeInTheDocument();
  });

  it("opens each person's limits by day and month with the owner's own pair", async () => {
    open();
    await userEvent.click(await screen.findByRole("button", { name: /Each person/ }));

    await waitFor(() => expect(pane().textContent).toContain("20,000"));
    const text = pane().textContent ?? "";
    expect(text).toContain("300,000");
    expect(text).toContain("100,000");
    expect(text).toContain("2,000,000");
  });

  it("shows what each person has used this month, by name", async () => {
    open();
    await userEvent.click(await screen.findByRole("button", { name: /Each person/ }));

    await waitFor(() => expect(pane().textContent).toContain("Balogh Anna"));
    const text = pane().textContent ?? "";
    expect(text).toContain("Kiss Péter");
    expect(text).toContain("1,500");
    expect(text).toContain("3,000");
  });

  it("names an actor with no display name by a neutral word, never by an id", async () => {
    const nameless = "dbc62e71-1111-4222-8333-444455556666";
    const stranger = "9f3a77c2-aaaa-4bbb-8ccc-ddddeeeeffff";
    actors = [{ id: nameless }];
    extraRows = [
      { day: "2026-11-18", role_id: "r1", person: nameless, tokens_in: 100, tokens_out: 50, requests: 1 },
      { day: "2026-11-18", role_id: "r1", person: stranger, tokens_in: 20, tokens_out: 10, requests: 1 },
    ];
    open();
    await userEvent.click(await screen.findByRole("button", { name: /Each person/ }));

    await waitFor(() => expect(pane().textContent).toContain("Unnamed person"));
    const text = pane().textContent ?? "";
    expect(text).not.toContain("dbc62e71");
    expect(text).not.toContain("9f3a77c2");
    expect(text).toContain("Unnamed person 180");
  });

  it("opens an AI agent to what it may see and change, its limits, its account's limits and its use", async () => {
    open();
    await userEvent.click(await screen.findByRole("button", { name: /Records reader/ }));

    await waitFor(() => expect(pane().textContent).toContain("See residents"));
    const text = pane().textContent ?? "";
    expect(text).toContain("See bills");
    expect(text).not.toContain("Change bills");
    expect(text).toContain("50,000");
    expect(text).toContain("900,000");
    expect(text).toContain("Muse Spark 1.3");
    expect(text).toContain("4,000,000");
    expect(text).toContain("4,000");
  });

  it("says an agent that may change things may change them", async () => {
    open();
    await userEvent.click(await screen.findByRole("button", { name: /Drafting helper/ }));

    await waitFor(() => expect(pane().textContent).toContain("Change bills"));
    expect(pane().textContent).toContain("No limits set");
  });

  it("opens the first row by itself on a wide screen", async () => {
    open(true);

    await waitFor(() => expect(pane()).not.toBeNull());
    await waitFor(() => expect(pane().textContent).toContain("20,000"));
  });

  it("has no button that writes", async () => {
    open(true);
    await waitFor(() => expect(pane().textContent).toContain("20,000"));

    const names = called.mock.calls.map(([, name]) => name);
    expect(names.filter((name) => /set_|create|update|delete/.test(name))).toEqual([]);
    expect(screen.queryByRole("button", { name: /save|change limit|edit/i })).toBeNull();
  });

  it("still opens an agent when the reader may not read its seat or its use", async () => {
    refuse = ["agency_get_role", "ai_usage_breakdown", "ai_get_account"];
    open();
    await userEvent.click(await screen.findByRole("button", { name: /Records reader/ }));

    await waitFor(() => expect(pane().textContent).toContain("50,000"));
    expect(pane().textContent).not.toMatch(/error|undefined|null/i);
  });
});
