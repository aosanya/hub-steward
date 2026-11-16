import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../agency/open";
import { words } from "../entry/words";
import type { Risk, RiskAction } from "../risks/api";
import { forgetRuntimeConfig, setRuntimeConfig } from "../shared/wakala/config";
import { forgetSubject } from "../shared/wakala/me";
import { resetMcp } from "../shared/wakala/mcp";
import { CouncilRisksPage } from "./CouncilRisksPage";
import { mcpCouncilRisksClient, overdueOf, type CouncilRisks, type CouncilRisksClient } from "./councilRisksApi";

const councilWords = words as Record<string, string>;

beforeEach(() => {
  window.localStorage.clear();
  openAgency("council-agency");
});

afterEach(() => {
  forgetOpenAgency();
  window.localStorage.clear();
});

const risk = (over: Partial<Risk> = {}): Risk => ({
  id: "r1",
  title: "Boiler room fire",
  topEvent: "Fire in the boiler room",
  status: "open",
  owner: "officer-ilona",
  ...over,
});

const action = (over: Partial<RiskAction> = {}): RiskAction => ({
  id: "a1",
  riskId: "r1",
  title: "Service the sprinklers",
  status: "open",
  dueAt: "2026-09-01T00:00:00Z",
  owner: "officer-ilona",
  ...over,
});

const loaded = (over: Partial<CouncilRisks> = {}): CouncilRisks => ({
  risks: [risk(), risk({ id: "r2", title: "Archive flood", status: "accepted", owner: "officer-bence" })],
  overdueActions: [action()],
  ...over,
});

const client = (over: Partial<CouncilRisksClient> = {}): CouncilRisksClient => ({
  load: async () => loaded(),
  ...over,
});

const base = "/a/council-agency";

const at = (fake: CouncilRisksClient) =>
  render(
    <MemoryRouter initialEntries={[`${base}/council-risks`]}>
      <Routes>
        <Route path={`${base}/council-risks`} element={<CouncilRisksPage client={fake} />} />
      </Routes>
    </MemoryRouter>,
  );

const textAround = (node: HTMLElement) => node.closest("li, button, article, section, div")?.parentElement?.textContent ?? node.textContent ?? "";

describe("the council risks page", () => {
  it("lists the overdue actions with their title, owner and due date", async () => {
    at(client());
    const title = await screen.findByText("Service the sprinklers");
    const text = textAround(title);
    expect(text).toContain("officer-ilona");
    expect(text).toContain("2026-09-01");
  });

  it("puts the overdue actions before the risks", async () => {
    at(client());
    const overdue = await screen.findByText("Service the sprinklers");
    const listed = screen.getByText("Archive flood");
    expect(overdue.compareDocumentPosition(listed) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("lists every risk with its owner and status", async () => {
    at(client());
    const flood = await screen.findByText("Archive flood");
    const text = textAround(flood);
    expect(text).toContain("officer-bence");
    expect(text).toContain(words.statusAccepted);
    const fire = screen.getByText("Boiler room fire");
    expect(textAround(fire)).toContain(words.statusOpen);
  });

  it("shows a member who owns nothing everything the client returns", async () => {
    at(
      client({
        load: async () =>
          loaded({
            risks: [risk({ id: "x1", title: "Not mine one", owner: "someone-else" }), risk({ id: "x2", title: "Not mine two", owner: "another" })],
            overdueActions: [action({ id: "y1", title: "Not mine action", owner: "someone-else" })],
          }),
      }),
    );
    expect(await screen.findByText("Not mine one")).toBeInTheDocument();
    expect(screen.getByText("Not mine two")).toBeInTheDocument();
    expect(screen.getByText("Not mine action")).toBeInTheDocument();
  });

  it("says so when there are no risks", async () => {
    at(client({ load: async () => loaded({ risks: [], overdueActions: [] }) }));
    expect(await screen.findByText(councilWords.councilRisksEmpty)).toBeInTheDocument();
  });

  it("says so when the risks cannot be loaded", async () => {
    at(client({ load: async () => Promise.reject(new Error("down")) }));
    expect(await screen.findByRole("alert")).toHaveTextContent(councilWords.councilRisksFailed);
  });

  it("offers no button that writes", async () => {
    at(client());
    await screen.findByText("Service the sprinklers");
    const names = screen.queryAllByRole("button").map((button) => button.textContent ?? "");
    for (const name of names) {
      expect(name).not.toMatch(/reassign|assign|close|remove|delete|save|send|add|create|record|evidence|done|complete/i);
    }
  });
});

describe("the overdue actions", () => {
  const today = new Date("2026-11-13T09:00:00Z");

  it("keeps the actions due before today that are not finished, oldest due first", () => {
    const found = overdueOf(
      [
        action({ id: "late-b", dueAt: "2026-10-20T00:00:00Z" }),
        action({ id: "future", dueAt: "2026-12-01T00:00:00Z" }),
        action({ id: "late-a", dueAt: "2026-08-02T00:00:00Z", status: "in_progress" }),
      ],
      today,
    );
    expect(found.map((a) => a.id)).toEqual(["late-a", "late-b"]);
  });

  it("drops the actions that are done, completed or closed", () => {
    const found = overdueOf(
      [
        action({ id: "done", status: "done" }),
        action({ id: "completed", status: "completed" }),
        action({ id: "closed", status: "closed" }),
        action({ id: "open", status: "open" }),
      ],
      today,
    );
    expect(found.map((a) => a.id)).toEqual(["open"]);
  });

  it("drops an action with no due date", () => {
    expect(overdueOf([action({ id: "undated", dueAt: "" })], today)).toEqual([]);
  });

  it("does not count an action due today as overdue", () => {
    expect(overdueOf([action({ id: "today", dueAt: "2026-11-13T00:00:00Z" })], today)).toEqual([]);
  });

  it("does not change the list it is given", () => {
    const given = [action({ id: "b", dueAt: "2026-10-20T00:00:00Z" }), action({ id: "a", dueAt: "2026-08-02T00:00:00Z" })];
    overdueOf(given, today);
    expect(given.map((a) => a.id)).toEqual(["b", "a"]);
  });
});

type Sent = { tool: string; args: Record<string, any> };

const stub = (replies: Record<string, unknown>) => {
  const sent: Sent[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).endsWith("/me")) return { ok: true, status: 200, json: async () => ({ subject: "mayor-bela" }) };
      const body = JSON.parse(String(init?.body || "{}"));
      let result: unknown = {};
      if (body.method === "tools/call") {
        sent.push({ tool: body.params.name, args: body.params.arguments });
        result = { structuredContent: replies[body.params.name] ?? { items: [] } };
      }
      const text = JSON.stringify({ jsonrpc: "2.0", id: body.id ?? 1, result });
      return { ok: true, status: 200, headers: new Headers({ "Mcp-Session-Id": "s1" }), text: async () => text };
    }),
  );
  return sent;
};

describe("the MCP council risks client", () => {
  beforeEach(() => {
    setRuntimeConfig({ wakala: "https://api.example", mcp: "https://api.example/mcp" });
    resetMcp();
    forgetSubject();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    forgetRuntimeConfig();
    resetMcp();
    forgetSubject();
  });

  it("asks for every risk and every action without an owner filter", async () => {
    const sent = stub({
      riskmanager_risk_list: {
        items: [
          { id: "r1", title: "Boiler room fire", top_event: "Fire", status: "open", owner: "officer-ilona" },
          { id: "r2", title: "Archive flood", top_event: "Water", status: "open", owner: "officer-bence" },
        ],
      },
      riskmanager_action_list: {
        items: [
          { id: "a1", risk_id: "r1", title: "Old action", status: "open", due_at: "2020-01-01T00:00:00Z", owner: "officer-bence" },
          { id: "a2", risk_id: "r2", title: "Finished action", status: "done", due_at: "2020-01-01T00:00:00Z", owner: "officer-ilona" },
          { id: "a3", risk_id: "r2", title: "Future action", status: "open", due_at: "2999-01-01T00:00:00Z", owner: "officer-ilona" },
        ],
      },
    });
    const council = await mcpCouncilRisksClient.load();
    expect(council.risks.map((r) => r.id)).toEqual(["r1", "r2"]);
    expect(council.overdueActions.map((a) => a.id)).toEqual(["a1"]);
    const risksCall = sent.find((call) => call.tool === "riskmanager_risk_list");
    const actionsCall = sent.find((call) => call.tool === "riskmanager_action_list");
    expect(risksCall).toBeDefined();
    expect(actionsCall).toBeDefined();
    expect(risksCall?.args ?? {}).not.toHaveProperty("owner");
    expect(actionsCall?.args ?? {}).not.toHaveProperty("owner");
  });
});
