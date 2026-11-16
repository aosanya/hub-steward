import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../agency/open";
import { words } from "../entry/words";
import { forgetRuntimeConfig, setRuntimeConfig } from "../shared/wakala/config";
import { forgetSubject } from "../shared/wakala/me";
import { resetMcp } from "../shared/wakala/mcp";
import { LateMattersPage } from "./LateMattersPage";
import { lateMatterOf, mcpLateMattersClient, type LateMatter, type LateMattersClient } from "./lateMattersApi";

const councilWords = words as Record<string, string>;

beforeEach(() => {
  window.localStorage.clear();
  openAgency("council-agency");
});

afterEach(() => {
  forgetOpenAgency();
  window.localStorage.clear();
});

const matter = (over: Partial<LateMatter> = {}): LateMatter => ({
  id: "m1",
  title: "Broken streetlight",
  place: "Fo utca 4",
  raisedAt: "2026-10-01T08:00:00Z",
  daysLate: 12,
  owner: "Roads",
  ...over,
});

const client = (over: Partial<LateMattersClient> = {}): LateMattersClient => ({
  list: async () => [matter()],
  ...over,
});

const base = "/a/council-agency";

const at = (fake: LateMattersClient) =>
  render(
    <MemoryRouter initialEntries={[`${base}/late-matters`]}>
      <Routes>
        <Route path={`${base}/late-matters`} element={<LateMattersPage client={fake} />} />
      </Routes>
    </MemoryRouter>,
  );

describe("the late matters page", () => {
  it("shows each matter with its title, place, days late and owner", async () => {
    at(client());
    const row = (await screen.findByText("Broken streetlight")).closest("li, div, button") as HTMLElement;
    const text = row.parentElement?.textContent ?? row.textContent ?? "";
    expect(text).toContain("Fo utca 4");
    expect(text).toContain("12");
    expect(text).toContain("Roads");
  });

  it("lists the matter that has been late longest first even when the client returns them unsorted", async () => {
    at(
      client({
        list: async () => [
          matter({ id: "a", title: "Three days late", daysLate: 3 }),
          matter({ id: "b", title: "Forty days late", daysLate: 40 }),
          matter({ id: "c", title: "Eleven days late", daysLate: 11 }),
        ],
      }),
    );
    await screen.findByText("Forty days late");
    const order = ["Forty days late", "Eleven days late", "Three days late"].map((title) => screen.getByText(title));
    for (let i = 1; i < order.length; i += 1) {
      expect(order[i - 1].compareDocumentPosition(order[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it("says so when nothing is late", async () => {
    at(client({ list: async () => [] }));
    expect(await screen.findByText(councilWords.lateMattersEmpty)).toBeInTheDocument();
  });

  it("says so when the late matters cannot be loaded", async () => {
    at(client({ list: async () => Promise.reject(new Error("down")) }));
    expect(await screen.findByRole("alert")).toHaveTextContent(councilWords.lateMattersFailed);
  });

  it("offers no button that writes", async () => {
    at(client());
    await screen.findByText("Broken streetlight");
    const names = screen.queryAllByRole("button").map((button) => button.textContent ?? "");
    for (const name of names) {
      expect(name).not.toMatch(/reassign|assign|close|remove|delete|save|send|add|raise|reply|answer|done/i);
    }
  });
});

describe("the late matter row mapper", () => {
  const now = new Date("2026-10-13T08:00:00Z");

  it("maps a listed raised item to a late matter with whole days since it was raised", () => {
    const row = {
      id: "ri-1",
      title: "Broken streetlight",
      address: "Fo utca 4",
      street: "Fo utca",
      area: "Center",
      department: "Roads",
      created_at: "2026-10-01T08:00:00Z",
    };
    expect(lateMatterOf(row, now)).toEqual({
      id: "ri-1",
      title: "Broken streetlight",
      place: "Fo utca 4",
      raisedAt: "2026-10-01T08:00:00Z",
      daysLate: 12,
      owner: "Roads",
    });
  });

  it("falls back to the street and then the area when the item has no address", () => {
    expect(lateMatterOf({ id: "a", street: "Fo utca", area: "Center", created_at: "2026-10-12T08:00:00Z" }, now).place).toBe("Fo utca");
    expect(lateMatterOf({ id: "b", area: "Center", created_at: "2026-10-12T08:00:00Z" }, now).place).toBe("Center");
  });

  it("counts only whole days", () => {
    expect(lateMatterOf({ id: "c", created_at: "2026-10-12T09:00:00Z" }, now).daysLate).toBe(0);
    expect(lateMatterOf({ id: "d", created_at: "2026-10-11T07:00:00Z" }, now).daysLate).toBe(2);
  });

  it("survives a row with nothing in it", () => {
    const empty = lateMatterOf({}, now);
    expect(empty.id).toBe("");
    expect(empty.title).toBe("");
    expect(empty.owner).toBe("");
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

describe("the MCP late matters client", () => {
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

  it("calls the overdue raised item list and maps every row", async () => {
    const sent = stub({
      forms_catalog_raised_item_list_overdue: {
        items: [
          { id: "ri-1", title: "Broken streetlight", address: "Fo utca 4", department: "Roads", created_at: "2020-01-01T00:00:00Z" },
          { id: "ri-2", title: "Pothole", street: "Kossuth utca", department: "Roads", created_at: "2020-02-01T00:00:00Z" },
        ],
      },
    });
    const found = await mcpLateMattersClient.list();
    expect(found.map((row) => row.id)).toEqual(["ri-1", "ri-2"]);
    expect(found[0].place).toBe("Fo utca 4");
    expect(found[1].place).toBe("Kossuth utca");
    expect(found[0].daysLate).toBeGreaterThan(365);
    expect(sent.map((call) => call.tool)).toEqual(["forms_catalog_raised_item_list_overdue"]);
  });
});

let landed = "";

const Where = () => {
  landed = useLocation().pathname;
  return null;
};

const section = { path: "/a/council-agency/menu/issues", title: "Issues & Requests" };

const atWithState = (state?: unknown) =>
  render(
    <MemoryRouter initialEntries={[{ pathname: `${base}/late-matters`, state }]}>
      <Routes>
        <Route path={`${base}/late-matters`} element={<LateMattersPage client={client()} />} />
        <Route path="*" element={null} />
      </Routes>
      <Where />
    </MemoryRouter>,
  );

describe("the late matters page opened from a menu section", () => {
  it("offers a Back button named after the section and goes back to the section", async () => {
    atWithState({ from: section });
    await screen.findByText("Broken streetlight");

    await userEvent.click(screen.getByRole("button", { name: /Issues & Requests/ }));

    expect(landed).toBe(section.path);
  });

  it("offers no Back button when it was not opened from a section", async () => {
    atWithState();
    await screen.findByText("Broken streetlight");

    expect(screen.queryByRole("button", { name: /‹/ })).toBeNull();
  });
});
