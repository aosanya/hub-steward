import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { App } from "../App";
import { agencyBasePath, agencyHomePath, forgetOpenAgency, openAgency, openAgencyId } from "../agency/open";
import { forgetRuntimeConfig, setRuntimeConfig } from "../wakala/config";
import { resetMcp } from "../wakala/mcp";
import { forgetSubject } from "../wakala/me";
import { forgetToken } from "../wakala/token";
import { provideEntryClient, type Agency, type EntryClient } from "./api";
import { provideWaitingCount, restoreWaitingCount } from "./waiting";
import { words } from "./words";

const farmers: Agency = { id: "270e07b7-6b69-55ca-aa30-9441ce138541", name: "Siaya Farmers' Group" };
const riders: Agency = { id: "c61e4358-10fd-539b-89f5-a7ccf4e94479", name: "Siaya Boda Boda Riders" };

const client = (agencies: Agency[]): EntryClient => ({
  sendSignInLink: async () => "sent",
  listAgencies: async () => agencies,
  searchDirectory: async () => [],
  join: async () => "joined",
});

const toolCalls = (fetcher: ReturnType<typeof vi.fn>) =>
  fetcher.mock.calls
    .map(([, init]) => JSON.parse(String(init?.body ?? "{}")))
    .filter((body) => body.method === "tools/call")
    .map((body) => ({ tool: String(body.params.name), instance: body.params.arguments?.instance_id }));

const stubWakala = () => {
  const fetcher = vi.fn(async (_url: string, init?: RequestInit) => {
    const body = String(init?.body ?? "");
    const text = body.includes('"initialize"')
      ? '{"jsonrpc":"2.0","id":1,"result":{}}'
      : body.includes('"agency_list_mounts"')
        ? '{"jsonrpc":"2.0","id":2,"result":{"structuredContent":{"modules":[{"module":"market","mounts":[{"name":"Market","key":"market"}]}]}}}'
        : '{"jsonrpc":"2.0","id":2,"result":{"structuredContent":{"items":[]}}}';
    return { ok: true, status: 200, headers: new Headers({ "Mcp-Session-Id": "s1" }), text: async () => text };
  });
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
};

const at = (path: string, agencies: Agency[]) => {
  provideEntryClient(client(agencies));
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
};

beforeEach(() => {
  setRuntimeConfig({ mcp: "https://api.example/mcp" });
  resetMcp();
  forgetOpenAgency();
  provideWaitingCount(async () => 0);
});

afterEach(() => {
  restoreWaitingCount();
  vi.unstubAllGlobals();
  forgetRuntimeConfig();
  resetMcp();
  forgetOpenAgency();
});

const tabLinks = () => within(screen.getByRole("navigation", { name: "Main" })).getAllByRole("link");

describe("a member in two agencies opens one", () => {
  it("builds every tab inside that agency", async () => {
    stubWakala();
    at("/agencies", [farmers, riders]);
    await userEvent.click(await screen.findByRole("button", { name: new RegExp(riders.name) }));
    await screen.findByRole("heading", { name: "Do Something" });
    const hrefs = tabLinks().map((link) => link.getAttribute("href"));
    const base = agencyBasePath(riders.id);
    expect(hrefs).toEqual([agencyHomePath(riders.id), `${base}/chat`, `${base}/inbox`]);
    expect(hrefs[0]).toBe(`${base}/do-something`);
  });

  it("stays in the agency on every tab and every call", async () => {
    const fetcher = stubWakala();
    at("/agencies", [farmers, riders]);
    const row = await screen.findByRole("button", { name: new RegExp(farmers.name) });
    fetcher.mockClear();
    await userEvent.click(row);
    await screen.findByRole("heading", { name: "Do Something" });
    await userEvent.click(screen.getByRole("link", { name: /Chat/ }));
    expect(await screen.findByRole("heading", { name: "Chat" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Chat/ })).toHaveAttribute("aria-current", "page");
    await userEvent.click(screen.getByRole("link", { name: /Inbox/ }));
    expect(await screen.findByRole("heading", { name: "Inbox" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("link", { name: /Do Something/ }));
    expect(await screen.findByRole("heading", { name: "Do Something" })).toBeInTheDocument();
    tabLinks().forEach((link) => expect(link.getAttribute("href")).toContain(agencyBasePath(farmers.id)));
    const calls = toolCalls(fetcher);
    expect(calls.length).toBeGreaterThan(0);
    calls.forEach((call) => expect(call.instance, call.tool).toBe(farmers.id));
    expect(openAgencyId()).toBe(farmers.id);
  });

  it("switches to the other agency's pages and calls when that one is opened", async () => {
    const fetcher = stubWakala();
    at(`/a/${farmers.id}/chat`, [farmers, riders]);
    await screen.findByRole("heading", { name: "Chat" });
    cleanup();
    fetcher.mockClear();
    openAgency(riders.id);
    at(`/a/${riders.id}/inbox`, [farmers, riders]);
    await screen.findAllByRole("heading", { name: "Inbox" });
    toolCalls(fetcher).forEach((call) => expect(call.instance, call.tool).toBe(riders.id));
  });
});

describe("the old tab paths", () => {
  it.each([
    ["/", "/do-something"],
    ["/chat", "/chat"],
    ["/inbox", "/inbox"],
  ])("send %s to the open agency's own page", async (path, tail) => {
    stubWakala();
    openAgency(riders.id);
    at(path, [farmers, riders]);
    const tab = tabLinks().find((link) => link.getAttribute("aria-current") === "page");
    expect(tab).toHaveAttribute("href", `${agencyBasePath(riders.id)}${tail}`);
  });

  it.each(["/", "/chat", "/inbox"])("send %s to Your agencies when no agency is open", async (path) => {
    stubWakala();
    at(path, [farmers, riders]);
    expect(await screen.findByRole("heading", { name: words.agenciesTitle })).toBeInTheDocument();
  });
});

describe("an agency the member does not belong to", () => {
  it.each(["", "/do-something", "/started", "/chat", "/inbox"])("sends /a/{id}%s back to Your agencies", async (tail) => {
    stubWakala();
    at(`/a/not-mine${tail}`, [farmers, riders]);
    expect(await screen.findByRole("heading", { name: words.agenciesTitle })).toBeInTheDocument();
    expect(openAgencyId()).toBe("");
  });
});

describe("the retired Started address", () => {
  it("sends /a/{id}/started to that agency's Do Something", async () => {
    stubWakala();
    at(`/a/${riders.id}/started`, [farmers, riders]);
    expect(await screen.findByRole("heading", { name: "Do Something" })).toBeInTheDocument();
    expect(tabLinks()[0]).toHaveAttribute("href", agencyHomePath(riders.id));
    expect(tabLinks()[0]).toHaveAttribute("aria-current", "page");
    expect(openAgencyId()).toBe(riders.id);
  });

  it("sends /started to the open agency's Do Something", async () => {
    stubWakala();
    openAgency(riders.id);
    at("/started", [farmers, riders]);
    expect(await screen.findByRole("heading", { name: "Do Something" })).toBeInTheDocument();
    expect(tabLinks()[0]).toHaveAttribute("href", agencyHomePath(riders.id));
  });

  it("sends /started to Your agencies when no agency is open", async () => {
    stubWakala();
    at("/started", [farmers, riders]);
    expect(await screen.findByRole("heading", { name: words.agenciesTitle })).toBeInTheDocument();
  });
});

describe("landing in an agency", () => {
  it("sends /a/{id} to that agency's Do Something", async () => {
    stubWakala();
    at(`/a/${riders.id}`, [farmers, riders]);
    expect(await screen.findByRole("heading", { name: "Do Something" })).toBeInTheDocument();
    expect(tabLinks()[0]).toHaveAttribute("href", agencyHomePath(riders.id));
    expect(tabLinks()[0]).toHaveAttribute("aria-current", "page");
    expect(openAgencyId()).toBe(riders.id);
  });

  it("leaves a stranger's /a/not-mine without Do Something and with no agency open", async () => {
    stubWakala();
    at("/a/not-mine", [farmers, riders]);
    expect(await screen.findByRole("heading", { name: words.agenciesTitle })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Do Something" })).not.toBeInTheDocument();
    expect(openAgencyId()).toBe("");
  });

  describe("by a sign-in link", () => {
    beforeEach(() => forgetSubject());
    afterEach(() => forgetToken());

    it("lands on the open agency's Do Something", async () => {
      stubWakala();
      openAgency(riders.id);
      at("/sign-in/link#access_token=t1&expires_in=3600&refresh_token=r1&token_type=bearer&type=magiclink", [farmers, riders]);
      expect(await screen.findByRole("heading", { name: "Do Something" })).toBeInTheDocument();
      expect(tabLinks()[0]).toHaveAttribute("href", agencyHomePath(riders.id));
    });
  });
});
