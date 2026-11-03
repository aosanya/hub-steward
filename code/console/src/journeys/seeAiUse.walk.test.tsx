import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { useEffect, useState, type ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { Reply } from "../data/chatAnswer";
import { askModel } from "../data/modelChat";
import { I18nProvider } from "../i18n";
import { UsageAgentsView, UsageOverviewView, UsageRedirect, UsageWorkView } from "../pages/usage/usageViews";
import { Frame } from "../shell/Frame";
import { SessionProvider, useSession } from "../session";
import { shortTokens } from "../ui";
import type { Hub } from "../types";
import { callTool } from "../wakala/mcp";
import { createFakeAiBackend, providerAnswered, type UsageRowJson } from "./fakeAiBackend";

vi.hoisted(() => {
  process.env.RTL_SKIP_AUTO_CLEANUP = "true";
});

vi.setConfig({ testTimeout: 30000 });

vi.mock("../wakala/mcp", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../wakala/mcp")>()),
  callTool: vi.fn(),
}));

vi.mock("../data/modelChat", () => ({ askModel: vi.fn() }));

type Rec = Record<string, unknown>;

const words = JSON.parse(readFileSync(resolve(__dirname, "../../public/i18n.json"), "utf8"));

const owner: Hub = { id: "siaya", name: "Siaya Farmers", role: "owner", kind: "farmers' group", model_key_set: true };
const staffSeat: Hub = { ...owner, role: "agent" };

const FARMERS = { id: "ro1", name: "Farmers' agent" };
const SUPPLIERS = { id: "ro2", name: "Suppliers' agent" };
const SPARK_13 = "Muse Spark 1.3";
const SPARK_12 = "Muse Spark 1.2";
const GLIMMER = "Muse Glimmer";

const people: Rec[] = [
  { id: "ac-asha", actor_id: "ac-asha", display_name: "Asha Otieno" },
  { id: "ac-grace", actor_id: "ac-grace", display_name: "Grace Adhiambo" },
  { id: "ac-kisumu", actor_id: "ac-kisumu", display_name: "Kisumu Agro Supplies" },
  { id: "ac-mgr", actor_id: "ac-mgr", display_name: "Hub manager" },
];

const usage = (day: string, model: string, role: { id: string; name: string }, kind: string, person: string, tokensIn: number, tokensOut: number, requests: number): UsageRowJson => ({
  day,
  model,
  role_id: role.id,
  role: role.name,
  kind,
  person,
  tokens_in: tokensIn,
  tokens_out: tokensOut,
  requests,
});

const rows: UsageRowJson[] = [
  usage("2026-10-03", SPARK_13, FARMERS, "chat", "ac-asha", 300000, 100000, 160),
  usage("2026-10-10", SPARK_13, FARMERS, "chat", "ac-grace", 200000, 80000, 110),
  usage("2026-10-12", SPARK_13, SUPPLIERS, "chat", "ac-kisumu", 180000, 70000, 100),
  usage("2026-10-14", SPARK_12, FARMERS, "test_run", "ac-mgr", 120000, 20000, 33),
  usage("2026-10-15", SPARK_12, FARMERS, "test_run", "ac-mgr", 110000, 20000, 31),
  usage("2026-10-15", SPARK_12, SUPPLIERS, "test_run", "ac-mgr", 100000, 15000, 28),
  usage("2026-10-20", GLIMMER, FARMERS, "background_job", "", 60000, 20000, 50),
  usage("2026-10-22", SPARK_13, SUPPLIERS, "workflow_run", "ac-kisumu", 90000, 20000, 40),
];

const sum = (list: UsageRowJson[], pick: (row: UsageRowJson) => number) => list.reduce((total, row) => total + pick(row), 0);
const tokensOf = (list: UsageRowJson[]) => sum(list, (row) => row.tokens_in + row.tokens_out);
const count = (value: number) => value.toLocaleString("en");
const percent = (part: number, whole: number) => Math.round((part * 100) / whole);

const totalTokens = tokensOf(rows);
const farmersRows = rows.filter((row) => row.role_id === FARMERS.id);
const testRows = rows.filter((row) => row.kind === "test_run");

const backend = createFakeAiBackend({ hubId: owner.id, provider: () => providerAnswered("OK", 5), roles: [], usage: rows });

const calls: { tool: string; args: Rec }[] = [];

const fakeAgency = async (hub: string, tool: string, args: Rec = {}) => {
  calls.push({ tool, args });
  if (tool.startsWith("ai_")) return backend.callTool(hub, tool, args);
  if (tool === "actor_list_actors") return { items: people };
  return { items: [] };
};

const usageCalls = () => calls.filter((call) => call.tool === "ai_usage_breakdown").map((call) => call.args);

const askModelMock = vi.mocked(askModel);

function Seed({ hub, children }: { hub: Hub; children: ReactNode }) {
  const { startSession } = useSession();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    startSession([hub]);
    setReady(true);
  }, [startSession, hub]);
  return ready ? <>{children}</> : null;
}

const mountConsole = (hub: Hub, path: string) => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), "http://console.test").pathname;
      const data = url === "/instances" ? [{ id: hub.id, name: hub.name, role: hub.role, kind: hub.kind }] : {};
      return { ok: true, status: 200, json: async () => data };
    }),
  );
  return render(
    <MemoryRouter initialEntries={[path]}>
      <I18nProvider initial={words}>
        <SessionProvider>
          <Seed hub={hub}>
            <Routes>
              <Route path="/h/:hubId" element={<Frame />}>
                <Route path="status" element={<h1>Status</h1>} />
                <Route path="models" element={<h1>Models</h1>} />
                <Route path="usage" element={<UsageRedirect />} />
                <Route path="usage-overview" element={<UsageOverviewView />} />
                <Route path="usage-work" element={<UsageWorkView />} />
                <Route path="usage-agents" element={<UsageAgentsView />} />
              </Route>
            </Routes>
          </Seed>
        </SessionProvider>
      </I18nProvider>
    </MemoryRouter>,
  );
};

const user = userEvent.setup();

const main = () => within(document.querySelector("main") as HTMLElement);
const menu = () => within(screen.getByRole("navigation", { name: "Menu" }));
const chat = () => within(screen.getByRole("complementary", { name: "Chat" }));
const heading = (name: string, level = 1) => screen.findByRole("heading", { level, name });
const pressed = (name: string) => main().getByRole("button", { name }).getAttribute("aria-pressed");
const chipsOf = () => [...document.querySelectorAll("main .filter")].map((chip) => chip.textContent);

const openFromMenu = async (page: string) => {
  await user.click(menu().getByRole("link", { name: new RegExp("^" + page + "$") }));
  await heading("Usage");
};

const askChat = async (reply: Reply, text: string) => {
  askModelMock.mockResolvedValue(reply);
  await waitFor(() => expect(chat().getByRole("button", { name: SPARK_13 })).toBeInTheDocument());
  await user.type(chat().getByRole("textbox", { name: "Write a message" }), text + "{Enter}");
};

beforeAll(async () => {
  window.localStorage.clear();
  vi.mocked(callTool).mockImplementation(fakeAgency as unknown as typeof callTool);
  const account = await backend.callTool<{ id: string }>(owner.id, "ai_create_account", {
    name: "Muse Spark",
    provider: "openai_compatible",
    base_url: "https://models.example/v1",
    model_name: "muse-spark-1.3",
    status: "enabled",
    chat_enabled: true,
    chat_label: SPARK_13,
  });
  await backend.callTool(owner.id, "ai_set_account_key", { accountID: account.id, key: "k-test" });
  mountConsole(owner, "/h/siaya/status");
});

afterAll(() => {
  cleanup();
  vi.unstubAllGlobals();
  delete process.env.RTL_SKIP_AUTO_CLEANUP;
});

describe("See where the tokens go: the whole journey", () => {
  it("step 1 · opens Models, then Usage under it, and sees the month: four figures and the tokens of each day by model", async () => {
    await user.click(await menu().findByRole("link", { name: /^Models$/ }));
    expect(await menu().findByRole("link", { name: "Configure" })).toBeInTheDocument();
    await user.click(await menu().findByRole("link", { name: /^Usage$/ }));
    await heading("Usage");

    for (const name of ["Overview", "Kind of work", "Agents and people"])
      expect(menu().getByRole("link", { name })).toBeInTheDocument();

    expect(usageCalls().at(-1)).toMatchObject({ window: "month", group_by: "agent" });
    expect(pressed("This month")).toBe("true");
    for (const span of ["Today", "7 days", "Last month"]) expect(pressed(span)).toBe("false");

    const figure = async (label: string) => (await main().findByText(label)).parentElement as HTMLElement;
    const inputShare = percent(sum(rows, (row) => row.tokens_in), totalTokens);
    const topModelRows = rows.filter((row) => row.model === SPARK_13);
    expect(within(await figure("Tokens")).getByText(shortTokens(totalTokens))).toBeInTheDocument();
    expect(within(await figure("Requests")).getByText(count(sum(rows, (row) => row.requests)))).toBeInTheDocument();
    expect(within(await figure("Input vs output")).getByText(`${inputShare} / ${100 - inputShare}`)).toBeInTheDocument();
    const top = await figure("Top model");
    expect(within(top).getByText(`${percent(tokensOf(topModelRows), totalTokens)}%`)).toBeInTheDocument();
    expect(within(top).getByText(SPARK_13)).toBeInTheDocument();

    expect(await main().findByText("Tokens per day, by model")).toBeInTheDocument();
    expect(main().getByRole("img", { name: /^Tokens per day by model/ })).toBeInTheDocument();
  });

  it("step 1 · Kind of work shows the share of each kind and the model against kind grid", async () => {
    await openFromMenu("Kind of work");

    const donut = main().getByRole("img", { name: /^Share of tokens by kind of work/ });
    for (const kind of ["Chat", "Test run", "Workflow run", "Background job"]) expect(within(donut).getByText(new RegExp("^" + kind + ":"))).toBeInTheDocument();
    expect(within(donut).queryByText(/^Agency review:/)).toBeNull();
    const chatTokens = tokensOf(rows.filter((row) => row.kind === "chat"));
    expect(within(donut).getByText(`Chat: ${count(chatTokens)} tokens, ${percent(chatTokens, totalTokens)}%`)).toBeInTheDocument();

    const grid = main().getByRole("table", { name: /^Tokens by model and kind of work/ });
    const sparkChat = tokensOf(rows.filter((row) => row.model === SPARK_13 && row.kind === "chat"));
    expect(within(grid).getByRole("cell", { name: `${SPARK_13} · Chat: ${count(sparkChat)} tokens` })).toHaveTextContent(shortTokens(sparkChat));
    expect(within(grid).getByRole("cell", { name: `${GLIMMER} · Chat: 0 tokens` })).toHaveTextContent("–");
  });

  it("step 1 · the first visit, before any call, says there are no calls and carries a Test a model button", async () => {
    await openFromMenu("Overview");
    await user.click(main().getByRole("button", { name: "Last month" }));

    expect(await main().findByText(/^No calls yet/)).toBeInTheDocument();
    expect(usageCalls().at(-1)).toMatchObject({ window: "last_month" });
    expect(main().queryByRole("img", { name: /^Tokens per day by model/ })).toBeNull();
    await user.click(main().getByRole("link", { name: "Test a model" }));
    expect(await heading("Models")).toBeInTheDocument();
  });

  it("step 2 · Agents and people charges the tokens to agents, then to people, with The agent itself for a job nobody started", async () => {
    await openFromMenu("Usage");
    await openFromMenu("Agents and people");

    expect(main().getByText("By agent")).toBeInTheDocument();
    const byAgent = (name: string, list: UsageRowJson[]) =>
      main().getByRole("button", { name: new RegExp("^" + name + ": " + count(sum(list, (row) => row.tokens_in)) + " tokens in") });
    expect(byAgent(FARMERS.name, farmersRows)).toBeInTheDocument();
    expect(main().getByRole("columnheader", { name: "Agent" })).toBeInTheDocument();
    expect(main().getByText("Breakdown")).toBeInTheDocument();

    await user.click(main().getByRole("button", { name: "Person" }));
    expect(await main().findByText("By person")).toBeInTheDocument();
    expect(usageCalls().at(-1)).toMatchObject({ window: "month", group_by: "person" });
    expect(main().getByRole("columnheader", { name: "Person" })).toBeInTheDocument();
    for (const name of ["Asha Otieno", "Grace Adhiambo", "Kisumu Agro Supplies", "Hub manager", "The agent itself"])
      expect(main().getAllByText(name).length).toBeGreaterThan(0);
    expect(main().queryByRole("button", { name: new RegExp("^" + FARMERS.name) })).toBeNull();

    await user.click(main().getByRole("button", { name: "Agent" }));
    expect(await main().findByText("By agent")).toBeInTheDocument();
  });

  it("step 3 · clicking an agent's bar filters the Usage pages to that agent, and the chip's x brings the hub back", async () => {
    await user.click(main().getByRole("button", { name: new RegExp("^" + FARMERS.name + ":") }));

    await waitFor(() => expect(chipsOf().join(" ")).toContain(`Role: ${FARMERS.name}`));
    expect(await main().findByText(`Who used ${FARMERS.name}`)).toBeInTheDocument();
    const asked = usageCalls().at(-1) as Rec;
    expect(asked).toMatchObject({ window: "month" });
    for (const name of ["Asha Otieno", "Grace Adhiambo", "Hub manager", "The agent itself"]) expect(main().getAllByText(name).length).toBeGreaterThan(0);
    expect(main().queryByText("Kisumu Agro Supplies")).toBeNull();
    expect(main().queryByText(SUPPLIERS.name)).toBeNull();

    await openFromMenu("Kind of work");
    await waitFor(() => expect(chipsOf().join(" ")).toContain(`Role: ${FARMERS.name}`));
    const donut = main().getByRole("img", { name: /^Share of tokens by kind of work/ });
    expect(within(donut).queryByText(/^Workflow run:/)).toBeNull();
    const farmersChat = tokensOf(farmersRows.filter((row) => row.kind === "chat"));
    expect(within(donut).getByText(`Chat: ${count(farmersChat)} tokens, ${percent(farmersChat, tokensOf(farmersRows))}%`)).toBeInTheDocument();

    await user.click(main().getByRole("button", { name: /^Remove/ }));
    await waitFor(() => expect(chipsOf().join(" ")).not.toContain("Role:"));
    expect(within(main().getByRole("img", { name: /^Share of tokens by kind of work/ })).getByText(/^Workflow run:/)).toBeInTheDocument();
  });

  it("step 4 · asking the chat why test runs used so much fills the content area with the answer", async () => {
    const prompt = "Why did test runs use so much of the month?";
    const reply: Reply = {
      text: "Test runs used most of it on 14 to 16 Oct.",
      calls: [{ name: "ai_usage_breakdown", summary: "kind test_run, this month", state: "done", ms: 164 }],
      answer: { kind: "action", prompt, view: "usageAnswer", title: "", params: { kind: "test_run", window: "month" } },
    };
    await askChat(reply, prompt);

    expect(await chat().findByText(reply.text)).toBeInTheDocument();
    expect(await main().findByText(prompt)).toBeInTheDocument();
    const testTokens = tokensOf(testRows);
    expect((await main().findAllByText(shortTokens(testTokens))).length).toBeGreaterThan(0);
    expect(main().getAllByText(new RegExp(`${percent(testTokens, totalTokens)}%`)).length).toBeGreaterThan(0);
    expect(main().getAllByText(String(sum(testRows, (row) => row.requests))).length).toBeGreaterThan(0);
    const busiestDay = new Intl.DateTimeFormat("en", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date("2026-10-15T00:00:00Z"));
    expect(main().getAllByText(busiestDay).length).toBeGreaterThan(0);
    expect(main().getAllByText("Hub manager").length).toBeGreaterThan(0);
    expect(main().getAllByText(FARMERS.name).length).toBeGreaterThan(0);
    expect(main().getAllByText(SUPPLIERS.name).length).toBeGreaterThan(0);
  });

  it("step 5 · a staff seat sees no Usage in the menu and the page shows one plain line", async () => {
    cleanup();
    calls.length = 0;
    mountConsole(staffSeat, "/h/siaya/usage-overview");

    expect(await main().findByText("Only the hub manager sees Usage.")).toBeInTheDocument();
    await waitFor(() => expect(menu().getByRole("link", { name: /^Models$/ })).toBeInTheDocument());
    for (const name of ["Usage", "Overview", "Kind of work", "Agents and people"]) expect(menu().queryByRole("link", { name })).toBeNull();
    expect(usageCalls()).toHaveLength(0);
  });
});
