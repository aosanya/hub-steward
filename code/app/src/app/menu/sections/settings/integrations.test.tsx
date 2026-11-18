import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { Integrations } from "./Integrations";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

const origin = { path: "/a/town/menu/settings", title: "Settings" };

const muse = {
  id: "a1",
  name: "Muse Spark 1.3",
  provider: "openai_compatible",
  base_url: "https://models.example.org/v1",
  model_name: "muse-spark-1.3",
  status: "active",
  key_set: true,
  tokens_per_day: 200000,
  tokens_per_month: 4000000,
  requests_per_minute: 30,
  tokens_per_call: null,
};

const writer = { id: "a2", name: "Writing helper", provider: "anthropic", base_url: "", model_name: "", status: "active", key_set: false };

let called: MockInstance<typeof mcp.callTool>;
let refuseRead: boolean;

const pane = () => document.querySelector(".mw-detail") as HTMLElement;

const setWide = (wide: boolean) => {
  window.matchMedia = ((query: string) => ({
    matches: wide,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })) as unknown as typeof window.matchMedia;
};

beforeEach(() => {
  openAgency("town");
  refuseRead = false;
  called = vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => {
    if (name === "ai_list_accounts") return { items: [muse, writer] };
    if (name === "ai_get_account") {
      if (refuseRead) throw new mcp.McpError("not allowed");
      const id = (args as { id?: string; accountID?: string }).id ?? (args as { accountID?: string }).accountID;
      return id === "a2" ? writer : muse;
    }
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
    <MemoryRouter initialEntries={[{ pathname: "/a/town/menu/settings/integrations", state: { from: origin } }]}>
      <Routes>
        <Route path="/a/:agencyId/menu/settings/integrations" element={<Integrations />} />
        <Route path="*" element={null} />
      </Routes>
    </MemoryRouter>,
  );
};

describe("Integrations", () => {
  it("lists each account by its name with whether it is connected", async () => {
    open();

    const row = (await screen.findByText("Muse Spark 1.3")).closest("button") as HTMLElement;
    expect(within(row).getByText(/Connected/)).toBeInTheDocument();
    const other = screen.getByText("Writing helper").closest("button") as HTMLElement;
    expect(within(other).getByText(/Not connected/)).toBeInTheDocument();
  });

  it("opens an account to its name, provider, address, model, status and limits on a phone", async () => {
    open();
    await userEvent.click(await screen.findByRole("button", { name: /Muse Spark 1.3/ }));

    await waitFor(() => expect(pane()).not.toBeNull());
    await waitFor(() => expect(pane().textContent).toContain("https://models.example.org/v1"));
    const text = pane().textContent ?? "";
    expect(text).toContain("Muse Spark 1.3");
    expect(text).toContain("openai_compatible");
    expect(text).toContain("muse-spark-1.3");
    expect(text).toContain("Connected");
    expect(text).toContain("200,000");
    expect(text).toContain("4,000,000");
    expect(text).toContain("30");
  });

  it("never asks for or shows a key", async () => {
    open();
    await userEvent.click(await screen.findByRole("button", { name: /Muse Spark 1.3/ }));
    await waitFor(() => expect(pane().textContent).toContain("muse-spark-1.3"));

    expect(called.mock.calls.map(([, name]) => name)).not.toContain("ai_set_account_key");
    expect(document.body.textContent).not.toMatch(/api[_ ]?key|secret|token_value/i);
  });

  it("opens the first account by itself on a wide screen", async () => {
    open(true);

    await waitFor(() => expect(pane()).not.toBeNull());
    await waitFor(() => expect(pane().textContent).toContain("muse-spark-1.3"));
    expect(pane().textContent).toContain("https://models.example.org/v1");
  });

  it("still opens an account from the list row when the reader may not read one account", async () => {
    refuseRead = true;
    open();
    await userEvent.click(await screen.findByRole("button", { name: /Muse Spark 1.3/ }));

    await waitFor(() => expect(pane().textContent).toContain("muse-spark-1.3"));
    expect(pane().textContent).toContain("https://models.example.org/v1");
  });

  it("says no limits are set for an account that has none", async () => {
    open();
    await userEvent.click(await screen.findByRole("button", { name: /Writing helper/ }));

    await waitFor(() => expect(pane().textContent).toContain("Not connected"));
    expect(pane().textContent).toContain("No limits set");
  });
});
