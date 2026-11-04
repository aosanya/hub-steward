import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode, useEffect, type ReactNode } from "react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../i18n";
import { SessionProvider, useSession } from "../session";
import type { Hub } from "../types";
import { setRuntimeConfig } from "../wakala/config";
import { McpError, callTool } from "../wakala/mcp";
import { CreateHub } from "./CreateHub";
import { Gate } from "./Gate";
import { Hubs } from "./Hubs";
import { SignIn } from "./SignIn";
import { Start } from "./Start";

vi.mock("../wakala/mcp", async (importOriginal) => ({ ...(await importOriginal<object>()), callTool: vi.fn() }));

const callToolMock = vi.mocked(callTool);

const wakala = "https://wakala.test";

const siaya: Hub = { id: "siaya", name: "Siaya hub", role: "owner" };
const kisumu: Hub = { id: "kisumu", name: "Kisumu hub", role: "owner" };

const membership = (hub: Hub, role = "owner") => ({ id: hub.id, name: hub.name, role, table_slug: "t_" + hub.id });

const words = {
  en: {
    title: "Hub Steward",
    headline: "Welcome to Hub Steward! Create your community and run it with ease!",
    create: "Create Hub",
    logIn: "Log in",
    hubName: "Hub name",
    email: "Email",
    password: "Password",
    back: "Back",
    submitFailed: "The change could not be sent.",
    hubNameRequired: "A hub name is required.",
    createNoService: "Hub Steward is not available on this server yet, so no hub was created.",
    createNoTemplate: "The hub template could not be loaded.",
    createNoRole: "The hub has no Hub Steward role, so the agent was not connected.",
    createNotLinked: "Hub Steward could not be linked to its role in the hub.",
    createNoRooms: "The hub's rooms could not be created.",
    "field.language": "Language",
    createStartFrom: "Start from",
    templateLab: "Computer lab",
    templateFarmers: "Farmers' group",
    templateRiders: "Boda boda riders",
    templateFreight: "Freight and logistics",
    templateDrone: "Drone crop spraying",
    templateClinical: "Clinical research",
    templateGrid: "Electric grid utility",
    templateMoney: "Mobile money operator",
    templateCounts: "{roles} roles · {goals} goals",
    agencyCounts: "{roles} roles · {goals} goals · {workflows} workflows",
    "field.agencyFile": "Import from a file",
    createFileBad: "That file is not an agency JSON file.",
    createCreating: "Creating your hub",
    createReady: "Your hub is ready",
    createOpenStatus: "Open Status",
    createStepTemplate: "Importing the agency template",
    createStepAgent: "Connecting Hub Steward to the hub",
    createStepGroups: "Creating the groups",
    createRunning: "Running",
    createWaiting: "Waiting",
    createFailedStep: "Failed",
    createProgress: "{done} of {total}",
    connected: "agent, connected",
    hubYours: "Your hubs",
    hubsRole: "Your role",
    hubNew: "New hub",
    hubsNone: "You do not run a hub yet",
    hubsCreate: "Create a hub",
    hubReady: "Ready",
    hubSettingUp: "Setting up",
    "hubKind.lab": "Lab",
    "hubKind.farmers": "Farmers",
    "hubKind.riders": "Riders",
    modelKey: "Model key",
    modelKeySet: "set",
    modelKeyNotSet: "not set",
    hubOpen: "Open",
    signOut: "Sign out",
    loadFailed: "The page could not be loaded.",
    retry: "Try again",
  },
  de: {
    title: "Hub Steward (de)",
    headline: "Willkommen bei Hub Steward!",
    create: "Hub erstellen",
    logIn: "Anmelden",
  },
};

type Reply = { status?: number; body?: unknown } | "unreachable";
type Call = { method: string; path: string; body: Record<string, unknown> | undefined; credentials: string | undefined };

const pathOf = (url: string) => (url.startsWith(wakala) ? url.slice(wakala.length) : url);

function stubFetch(replies: Record<string, Reply>) {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      const path = pathOf(url);
      calls.push({ method, path, body: init?.body ? JSON.parse(String(init.body)) : undefined, credentials: init?.credentials });
      const reply = replies[`${method} ${path}`];
      if (reply === "unreachable") throw new TypeError("network down");
      const status = reply ? (reply.status ?? 200) : 404;
      return { ok: status < 400, status, json: async () => reply?.body ?? {} };
    }),
  );
  return calls;
}

const template = { _template: { archetype: "community computer lab" }, agency: { name: "Siaya Community Computer Lab" }, roles: [] };

const goodServices: Record<string, Reply> = {
  "GET /services": { body: [{ service: "hub-steward", subject: "service-hub-steward" }] },
  "GET /templates/siaya-lab.json": { body: template },
  "POST /instances/import": { status: 201, body: { instance: { id: "kisumu", name: "Kisumu hub" }, draft_id: "d-1", created: {} } },
};

const visitorCanSignIn: Record<string, Reply> = { "POST /auth/signin": { status: 201, body: { expires_at: "2026-11-26T00:00:00Z" } } };

type ToolCall = { hubId: string; tool: string; args: Record<string, unknown> };

function stubTools(overrides: Record<string, (args: Record<string, unknown>) => unknown> = {}) {
  const calls: ToolCall[] = [];
  let groups = 0;
  const tools: Record<string, (args: Record<string, unknown>) => unknown> = {
    agency_list_drafts: () => ({ items: [{ id: "d-0", description: "Seed" }, { id: "d-1", description: "Imported from Kisumu hub" }] }),
    agency_list_roles: () => ({ items: [{ id: "r-1", name: "Hub manager" }, { id: "r-steward", name: "Hub Steward" }] }),
    agency_grant_service: (args) => ({ instance_id: "kisumu", service: args.service, subject: "service-hub-steward", agency_role_id: args.agency_role_id }),
    actor_create_group: (args) => ({ id: "g-" + ++groups, name: args.name }),
    actor_set_group_join_mode: () => ({}),
    ...overrides,
  };
  callToolMock.mockReset();
  callToolMock.mockImplementation(async (hubId: string, tool: string, args: Record<string, unknown> = {}) => {
    calls.push({ hubId, tool, args });
    if (!(tool in tools)) throw new McpError(`unexpected tool ${tool}`);
    const answer = tools[tool](args);
    if (answer instanceof Error) throw answer;
    return answer;
  });
  return calls;
}

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

function Session() {
  const { signedIn, hubs } = useSession();
  return <p data-testid="session">{signedIn ? "in:" + hubs.map((h) => h.id).join(",") : "out"}</p>;
}

function SignedInAs({ hubs, children }: { hubs: Hub[]; children: ReactNode }) {
  const { signedIn, startSession } = useSession();
  useEffect(() => startSession(hubs), [hubs, startSession]);
  return signedIn ? <>{children}</> : null;
}

function renderEntry(path: string, options: { signedInAs?: Hub[]; strict?: boolean } = {}) {
  const routes = (
    <Routes>
      <Route path="/" element={<Gate />} />
      <Route path="/start" element={<Start />} />
      <Route path="/login" element={<SignIn />} />
      <Route path="/create" element={<CreateHub />} />
      <Route path="*" element={<Where />} />
    </Routes>
  );
  const app = (
    <I18nProvider initial={words}>
      <SessionProvider>
        <MemoryRouter initialEntries={[path]}>
          {options.signedInAs ? <SignedInAs hubs={options.signedInAs}>{routes}</SignedInAs> : routes}
          <Session />
        </MemoryRouter>
      </SessionProvider>
    </I18nProvider>
  );
  render(options.strict ? <StrictMode>{app}</StrictMode> : app);
}

const whereNow = () => screen.getByTestId("where");

const pathsOf = (calls: Call[]) => calls.map((c) => `${c.method} ${c.path}`);

const toolNames = (calls: ToolCall[]) => calls.map((c) => c.tool);

beforeEach(() => {
  localStorage.clear();
  stubTools();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the gate at the root", () => {
  it("sends a signed-in manager to the first hub's status page", async () => {
    stubFetch({ "GET /auth/session": { body: { member_id: "m-1" } }, "GET /instances": { body: [membership(siaya), membership(kisumu)] } });
    renderEntry("/");
    await waitFor(() => expect(whereNow()).toHaveTextContent("/h/siaya/status"));
    expect(screen.getByTestId("session")).toHaveTextContent("in:siaya,kisumu");
  });

  it("asks wakala itself, with the browser's cookie, who is signed in", async () => {
    const calls = stubFetch({ "GET /auth/session": { body: { member_id: "m-1" } }, "GET /instances": { body: [membership(siaya)] } });
    renderEntry("/");
    await waitFor(() => expect(whereNow()).toHaveTextContent("/h/siaya/status"));
    expect(calls).toEqual([
      { method: "GET", path: "/auth/session", body: undefined, credentials: "include" },
      { method: "GET", path: "/instances", body: undefined, credentials: "include" },
    ]);
  });

  it("lists only the hubs the manager owns", async () => {
    stubFetch({
      "GET /auth/session": { body: { member_id: "m-1" } },
      "GET /instances": { body: [membership(siaya, "agent"), membership(kisumu), { id: "elsewhere", name: "Elsewhere", role: "resident" }] },
    });
    renderEntry("/");
    await waitFor(() => expect(whereNow()).toHaveTextContent("/h/kisumu/status"));
    expect(screen.getByTestId("session")).toHaveTextContent("in:kisumu");
  });

  it("sends a signed-in manager to the first hub even when React runs the effects twice", async () => {
    const calls = stubFetch({ "GET /auth/session": { body: {} }, "GET /instances": { body: [membership(kisumu), membership(siaya)] } });
    renderEntry("/", { strict: true });
    await waitFor(() => expect(whereNow()).toHaveTextContent("/h/kisumu/status"));
    expect(calls.every((c) => ["/auth/session", "/instances"].includes(c.path))).toBe(true);
  });

  it("sends a signed-in manager who has no hub yet to the create page", async () => {
    stubFetch({ "GET /auth/session": { body: {} }, "GET /instances": { body: [] } });
    renderEntry("/");
    expect(await screen.findByLabelText("Hub name")).toBeInTheDocument();
    expect(screen.getByTestId("session")).toHaveTextContent("in:");
  });

  it("sends a visitor who is not signed in to the start page", async () => {
    const calls = stubFetch({ "GET /auth/session": { status: 401, body: { error: "not signed in" } } });
    renderEntry("/");
    expect(await screen.findByRole("button", { name: "Log in" })).toBeInTheDocument();
    expect(screen.getByTestId("session")).toHaveTextContent("out");
    expect(pathsOf(calls)).toEqual(["GET /auth/session"]);
  });

  it("sends the visitor to the start page when the hub list is refused", async () => {
    stubFetch({ "GET /auth/session": { body: {} }, "GET /instances": { status: 401, body: { error: "authentication required" } } });
    renderEntry("/");
    expect(await screen.findByRole("button", { name: "Log in" })).toBeInTheDocument();
    expect(screen.getByTestId("session")).toHaveTextContent("out");
  });

  it("sends the visitor to the start page when the server cannot be reached", async () => {
    stubFetch({ "GET /auth/session": "unreachable" });
    renderEntry("/");
    expect(await screen.findByRole("button", { name: "Create Hub" })).toBeInTheDocument();
  });
});

describe("the start page", () => {
  it("shows the wordmark with the Demo chip, the headline and the two buttons", () => {
    renderEntry("/start");
    expect(screen.getByText("Hub Steward", { selector: ".brand" })).toBeInTheDocument();
    expect(screen.getByText("Demo")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: words.en.headline })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create Hub" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log in" })).toBeInTheDocument();
  });

  it("opens the create page from Create Hub", async () => {
    renderEntry("/start");
    await userEvent.click(screen.getByRole("button", { name: "Create Hub" }));
    expect(await screen.findByLabelText("Hub name")).toBeInTheDocument();
  });

  it("opens the login page from Log in", async () => {
    renderEntry("/start");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));
    expect(await screen.findByLabelText("Password")).toBeInTheDocument();
    expect(screen.queryByLabelText("Hub name")).not.toBeInTheDocument();
  });

  it("offers the six languages in a select with English chosen", () => {
    renderEntry("/start");
    const select = screen.getByRole("combobox", { name: "Language" });
    const names = within(select)
      .getAllByRole("option")
      .map((o) => o.textContent);
    expect(names).toEqual(["English", "Deutsch", "Kiswahili", "Español", "Français", "中文"]);
    expect(select).toHaveValue("en");
  });

  it("switches the words and the page language when a language is chosen, and remembers it", async () => {
    renderEntry("/start");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Language" }), "de");
    expect(screen.getByRole("heading", { name: "Willkommen bei Hub Steward!" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hub erstellen" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Anmelden" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Language" })).toHaveValue("de");
    expect(document.documentElement.lang).toBe("de");
    expect(localStorage.getItem("lang")).toBe("de");
  });

  it("keeps the chosen language on the login and create pages", async () => {
    renderEntry("/start");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Language" }), "de");
    await userEvent.click(screen.getByRole("button", { name: "Anmelden" }));
    expect(await screen.findByRole("combobox", { name: "Language" })).toHaveValue("de");
    expect(screen.getByRole("button", { name: "Anmelden" })).toBeInTheDocument();
  });

  it("names the browser tab in the chosen language", async () => {
    renderEntry("/start");
    expect(document.title).toBe("Hub Steward");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Language" }), "de");
    expect(document.title).toBe("Hub Steward (de)");
  });
});

describe("the login page", () => {
  it("signs in with the email and password and lands on the first hub's status page", async () => {
    const calls = stubFetch({ ...visitorCanSignIn, "GET /instances": { body: [membership(siaya), membership(kisumu)] } });
    renderEntry("/login");
    await userEvent.type(screen.getByLabelText("Email"), "wanjiru@example.org");
    await userEvent.type(screen.getByLabelText("Password"), "s3cret");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));
    await waitFor(() => expect(whereNow()).toHaveTextContent("/h/siaya/status"));
    expect(calls).toEqual([
      { method: "POST", path: "/auth/signin", body: { email: "wanjiru@example.org", password: "s3cret" }, credentials: "include" },
      { method: "GET", path: "/instances", body: undefined, credentials: "include" },
    ]);
    expect(screen.getByTestId("session")).toHaveTextContent("in:siaya,kisumu");
  });

  it("signs in when Enter is pressed in the password field", async () => {
    stubFetch({ ...visitorCanSignIn, "GET /instances": { body: [membership(kisumu)] } });
    renderEntry("/login");
    await userEvent.type(screen.getByLabelText("Email"), "a@b.c");
    await userEvent.type(screen.getByLabelText("Password"), "pw{Enter}");
    await waitFor(() => expect(whereNow()).toHaveTextContent("/h/kisumu/status"));
  });

  it("lands on the create page when the account has no hub yet", async () => {
    stubFetch({ ...visitorCanSignIn, "GET /instances": { body: [] } });
    renderEntry("/login");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));
    expect(await screen.findByLabelText("Hub name")).toBeInTheDocument();
    expect(screen.getByTestId("session")).toHaveTextContent("in:");
  });

  it("shows the error text wakala sent and stays on the page", async () => {
    const calls = stubFetch({ "POST /auth/signin": { status: 401, body: { error: "that email address and password do not match a sign-in" } } });
    renderEntry("/login");
    await userEvent.type(screen.getByLabelText("Email"), "a@b.c");
    await userEvent.type(screen.getByLabelText("Password"), "nope");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("that email address and password do not match a sign-in");
    expect(screen.getByLabelText("Email")).toHaveValue("a@b.c");
    expect(screen.getByTestId("session")).toHaveTextContent("out");
    expect(pathsOf(calls)).toEqual(["POST /auth/signin"]);
  });

  it("clears the earlier error while the next attempt is on its way", async () => {
    let release: () => void = () => {};
    const second = new Promise<void>((resolve) => {
      release = resolve;
    });
    const replies = [
      async () => ({ ok: false, status: 401, json: async () => ({ error: "that email address and password do not match a sign-in" }) }),
      async () => {
        await second;
        return { ok: true, status: 201, json: async () => ({}) };
      },
      async () => ({ ok: true, status: 200, json: async () => [membership(siaya)] }),
    ];
    vi.stubGlobal("fetch", vi.fn(() => replies.shift()!()));
    renderEntry("/login");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("that email address and password do not match a sign-in");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    release();
    await waitFor(() => expect(whereNow()).toHaveTextContent("/h/siaya/status"));
  });

  it("says the change could not be sent when wakala gives no reason", async () => {
    stubFetch({ "POST /auth/signin": { status: 500 } });
    renderEntry("/login");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("The change could not be sent.");
  });

  it("says the change could not be sent when wakala cannot be reached", async () => {
    stubFetch({ "POST /auth/signin": "unreachable" });
    renderEntry("/login");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("The change could not be sent.");
  });

  it("says the change could not be sent when sign-in works but the hubs cannot be listed", async () => {
    stubFetch({ ...visitorCanSignIn, "GET /instances": { status: 500 } });
    renderEntry("/login");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("The change could not be sent.");
    expect(screen.getByTestId("session")).toHaveTextContent("out");
  });

  it("has no Back button", () => {
    renderEntry("/login");
    expect(screen.queryByRole("button", { name: "Back" })).not.toBeInTheDocument();
  });

  it("shows a spinner on Log in and disables it while wakala has not answered", async () => {
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        await held;
        return { ok: false, status: 401, json: async () => ({ error: "that email address and password do not match a sign-in" }) };
      }),
    );
    renderEntry("/login");
    const button = screen.getByRole("button", { name: "Log in" });
    expect(button.querySelector(".tool-spin")).not.toBeInTheDocument();
    await userEvent.click(button);
    expect(button).toBeDisabled();
    expect(button.querySelector(".tool-spin")).toBeInTheDocument();
    release();
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(button).toBeEnabled();
    expect(button.querySelector(".tool-spin")).not.toBeInTheDocument();
  });
});

const fillCreateForm = async (hubName = "Kisumu hub", credentials?: { email: string; password: string }) => {
  await userEvent.type(screen.getByLabelText("Hub name"), hubName);
  if (credentials) {
    await userEvent.type(screen.getByLabelText("Email"), credentials.email);
    await userEvent.type(screen.getByLabelText("Password"), credentials.password);
  }
};

const pressCreate = () => userEvent.click(screen.getByRole("button", { name: "Create Hub" }));

const openStatus = async () => userEvent.click(await screen.findByRole("button", { name: "Open Status" }));

const manager = { email: "wanjiru@example.org", password: "s3cret" };

describe("the create page", () => {
  const agencyFile = (content: unknown) => new File([typeof content === "string" ? content : JSON.stringify(content)], "agency.json", { type: "application/json" });
  const chooseFile = (file: File) => userEvent.upload(document.querySelector('input[type="file"]') as HTMLInputElement, file);
  const fileAgency = { agency: { name: "Nyando Co-op" }, roles: [{}, {}], goals: [{}], workflows: [{}, {}, {}] };

  it("shows what a chosen agency file holds and fills the empty hub name from it", async () => {
    stubFetch({ ...visitorCanSignIn, ...goodServices });
    renderEntry("/create");
    await chooseFile(agencyFile(fileAgency));
    expect(await screen.findByText("Nyando Co-op · 2 roles · 1 goals · 3 workflows")).toBeInTheDocument();
    expect(screen.getByLabelText("Hub name")).toHaveValue("Nyando Co-op");
  });

  it("keeps the hub name the manager typed when a file is chosen", async () => {
    stubFetch({ ...visitorCanSignIn, ...goodServices });
    renderEntry("/create");
    await userEvent.type(screen.getByLabelText("Hub name"), "Kisumu hub");
    await chooseFile(agencyFile(fileAgency));
    await screen.findByText(/Nyando Co-op/);
    expect(screen.getByLabelText("Hub name")).toHaveValue("Kisumu hub");
  });

  it("says so in plain words when the file is not an agency", async () => {
    stubFetch({ ...visitorCanSignIn, ...goodServices });
    renderEntry("/create");
    await chooseFile(agencyFile("not json"));
    expect(await screen.findByRole("alert")).toHaveTextContent("That file is not an agency JSON file.");
  });

  it("imports the chosen file instead of a template and creates the hub", async () => {
    const calls = stubFetch({ ...visitorCanSignIn, ...goodServices });
    stubTools();
    renderEntry("/create");
    await chooseFile(agencyFile(fileAgency));
    await screen.findByText(/Nyando Co-op/);
    await userEvent.type(screen.getByLabelText("Email"), manager.email);
    await userEvent.type(screen.getByLabelText("Password"), manager.password);
    await pressCreate();
    await openStatus();
    await waitFor(() => expect(whereNow()).toHaveTextContent("/h/kisumu/status"));
    expect(pathsOf(calls)).toEqual(["POST /auth/signin", "GET /services", "POST /instances/import"]);
    expect(calls.find((c) => c.path === "/instances/import")?.body).toEqual({ ...fileAgency, name: "Nyando Co-op" });
  });

  it("asks a visitor for the hub name, the email and the password", () => {
    renderEntry("/create");
    expect(screen.getByLabelText("Hub name")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
  });

  it("asks a signed-in manager only for the hub name", () => {
    renderEntry("/create", { signedInAs: [siaya] });
    expect(screen.getByLabelText("Hub name")).toBeInTheDocument();
    expect(screen.queryByLabelText("Email")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
  });

  it("creates the hub for a visitor, signs them in with it and lands on its status page", async () => {
    const calls = stubFetch({ ...visitorCanSignIn, ...goodServices });
    renderEntry("/create");
    await fillCreateForm("Kisumu hub", manager);
    await pressCreate();
    await openStatus();
    await waitFor(() => expect(whereNow()).toHaveTextContent("/h/kisumu/status"));
    expect(pathsOf(calls)).toEqual(["POST /auth/signin", "GET /services", "GET /templates/siaya-lab.json", "POST /instances/import"]);
    expect(calls[0]).toMatchObject({ body: manager, credentials: "include" });
    expect(screen.getByTestId("session")).toHaveTextContent("in:kisumu");
  });

  it("imports the template under the name the manager typed, trimmed", async () => {
    const calls = stubFetch({ ...visitorCanSignIn, ...goodServices });
    renderEntry("/create");
    await fillCreateForm("  Kisumu hub  ", manager);
    await pressCreate();
    await openStatus();
    await waitFor(() => expect(whereNow()).toHaveTextContent("/h/kisumu/status"));
    const imported = calls.find((c) => c.path === "/instances/import")!;
    expect(imported.credentials).toBe("include");
    expect(imported.body).toEqual({ ...template, name: "Kisumu hub" });
  });

  it("fetches the template from the bundle, not from wakala", async () => {
    const calls = stubFetch({ ...visitorCanSignIn, ...goodServices });
    renderEntry("/create");
    await fillCreateForm("Kisumu hub", manager);
    await pressCreate();
    await openStatus();
    await waitFor(() => expect(whereNow()).toHaveTextContent("/h/kisumu/status"));
    const fetched = vi.mocked(fetch).mock.calls.map((c) => String(c[0]));
    expect(fetched).toContain("/templates/siaya-lab.json");
    expect(calls.find((c) => c.path === "/templates/siaya-lab.json")?.credentials).toBeUndefined();
  });

  it("finds the Hub Steward role in the imported draft and grants the Hub Steward service that role", async () => {
    stubFetch({ ...visitorCanSignIn, ...goodServices });
    const tools = stubTools();
    renderEntry("/create");
    await fillCreateForm("Kisumu hub", manager);
    await pressCreate();
    await openStatus();
    await waitFor(() => expect(whereNow()).toHaveTextContent("/h/kisumu/status"));
    expect(tools.slice(0, 3)).toEqual([
      { hubId: "kisumu", tool: "agency_list_drafts", args: {} },
      { hubId: "kisumu", tool: "agency_list_roles", args: { draft_id: "d-1" } },
      { hubId: "kisumu", tool: "agency_grant_service", args: { service: "hub-steward", agency_role_id: "r-steward" } },
    ]);
  });

  it("grants the service to the role that holds the AI permission when the template names its agent role differently", async () => {
    stubFetch({ ...visitorCanSignIn, ...goodServices });
    const tools = stubTools({
      agency_list_roles: () => ({
        items: [
          { id: "r-1", name: "Hub manager", permissions: ["member.read"] },
          { id: "r-5", name: "Farmers' coordinator", permissions: ["chat.thread", "ai.use"] },
        ],
      }),
    });
    renderEntry("/create");
    await fillCreateForm("Kisumu hub", manager);
    await pressCreate();
    await openStatus();
    await waitFor(() => expect(whereNow()).toHaveTextContent("/h/kisumu/status"));
    expect(tools.find((c) => c.tool === "agency_grant_service")?.args).toEqual({ service: "hub-steward", agency_role_id: "r-5" });
  });

  it("prefers the Hub Steward role when several roles hold the AI permission", async () => {
    stubFetch({ ...visitorCanSignIn, ...goodServices });
    const tools = stubTools({
      agency_list_roles: () => ({
        items: [
          { id: "r-9", name: "Reviewer", permissions: ["ai.use"] },
          { id: "r-steward", name: "Hub Steward", permissions: ["ai.use"] },
        ],
      }),
    });
    renderEntry("/create");
    await fillCreateForm("Kisumu hub", manager);
    await pressCreate();
    await openStatus();
    await waitFor(() => expect(whereNow()).toHaveTextContent("/h/kisumu/status"));
    expect(tools.find((c) => c.tool === "agency_grant_service")?.args).toEqual({ service: "hub-steward", agency_role_id: "r-steward" });
  });

  it("falls back to the role named Hub Steward when no role lists its permissions", async () => {
    stubFetch({ ...visitorCanSignIn, ...goodServices });
    const tools = stubTools({
      agency_list_roles: () => ({ items: [{ id: "r-1", name: "Hub manager" }, { id: "r-steward", name: "Hub Steward" }, { id: "r-2", name: "Farmer" }] }),
    });
    renderEntry("/create");
    await fillCreateForm("Kisumu hub", manager);
    await pressCreate();
    await openStatus();
    await waitFor(() => expect(whereNow()).toHaveTextContent("/h/kisumu/status"));
    expect(tools.find((c) => c.tool === "agency_grant_service")?.args).toEqual({ service: "hub-steward", agency_role_id: "r-steward" });
  });

  it("creates the five default rooms and opens each one to join", async () => {
    stubFetch({ ...visitorCanSignIn, ...goodServices });
    const tools = stubTools();
    renderEntry("/create");
    await fillCreateForm("Kisumu hub", manager);
    await pressCreate();
    await openStatus();
    await waitFor(() => expect(whereNow()).toHaveTextContent("/h/kisumu/status"));
    const rooms = tools.slice(3);
    expect(rooms.map((c) => c.tool)).toEqual(Array(3).fill(["actor_create_group", "actor_set_group_join_mode"]).flat());
    expect(rooms.filter((c) => c.tool === "actor_create_group").map((c) => c.args)).toEqual([
      { name: "Managers' room" },
      { name: "Farmers' room" },
      { name: "Suppliers' room" },
    ]);
    expect(rooms.filter((c) => c.tool === "actor_set_group_join_mode").map((c) => c.args)).toEqual(
      ["g-1", "g-2", "g-3"].map((id) => ({ group_id: id, join_mode: "open" })),
    );
    expect(rooms.every((c) => c.hubId === "kisumu")).toBe(true);
  });

  it("falls back to the first draft when none says it was imported", async () => {
    stubFetch({ ...visitorCanSignIn, ...goodServices });
    const tools = stubTools({ agency_list_drafts: () => ({ items: [{ id: "d-9", description: "" }] }) });
    renderEntry("/create");
    await fillCreateForm("Kisumu hub", manager);
    await pressCreate();
    await openStatus();
    await waitFor(() => expect(whereNow()).toHaveTextContent("/h/kisumu/status"));
    expect(tools[1].args).toEqual({ draft_id: "d-9" });
  });

  it("adds the new hub to a signed-in manager's hubs and lands on its status page without signing in again", async () => {
    const calls = stubFetch(goodServices);
    renderEntry("/create", { signedInAs: [siaya] });
    await fillCreateForm("Kisumu hub");
    await pressCreate();
    await openStatus();
    await waitFor(() => expect(whereNow()).toHaveTextContent("/h/kisumu/status"));
    expect(pathsOf(calls)).toEqual(["GET /services", "GET /templates/siaya-lab.json", "POST /instances/import"]);
    expect(screen.getByTestId("session")).toHaveTextContent("in:siaya,kisumu");
  });

  it("creates nothing and says so when the Hub Steward service is not available", async () => {
    const calls = stubFetch({
      ...goodServices,
      "GET /services": { body: [{ service: "another-service", subject: "service-another-service" }] },
    });
    const tools = stubTools();
    renderEntry("/create", { signedInAs: [siaya] });
    await fillCreateForm("Kisumu hub");
    await pressCreate();
    expect(await screen.findByRole("alert")).toHaveTextContent("Hub Steward is not available on this server yet, so no hub was created.");
    expect(pathsOf(calls)).toEqual(["GET /services"]);
    expect(tools).toEqual([]);
    expect(screen.getByTestId("session")).toHaveTextContent("in:siaya");
  });

  it("says the same when no service is registered at all", async () => {
    const calls = stubFetch({ ...goodServices, "GET /services": { body: [] } });
    renderEntry("/create", { signedInAs: [siaya] });
    await fillCreateForm("Kisumu hub");
    await pressCreate();
    expect(await screen.findByRole("alert")).toHaveTextContent("Hub Steward is not available on this server yet");
    expect(pathsOf(calls)).toEqual(["GET /services"]);
  });

  it("asks a signed-in manager for the credentials when wakala refuses the session", async () => {
    stubFetch({ ...goodServices, "GET /services": { status: 401, body: { error: "authentication required" } } });
    renderEntry("/create", { signedInAs: [siaya] });
    await fillCreateForm("Kisumu hub");
    await pressCreate();
    expect(await screen.findByRole("alert")).toHaveTextContent("authentication required");
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByLabelText("Hub name")).toHaveValue("Kisumu hub");
    expect(screen.getByTestId("session")).toHaveTextContent("in:siaya");
  });

  it("signs in again with the credentials asked for, then creates the hub and keeps the manager's other hubs", async () => {
    let refused = true;
    const calls: Call[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        const method = init?.method ?? "GET";
        const path = pathOf(url);
        calls.push({ method, path, body: init?.body ? JSON.parse(String(init.body)) : undefined, credentials: init?.credentials });
        if (method === "POST" && path === "/auth/signin") {
          refused = false;
          return { ok: true, status: 201, json: async () => ({}) };
        }
        if (path === "/services" && refused) return { ok: false, status: 401, json: async () => ({ error: "authentication required" }) };
        const reply = goodServices[`${method} ${path}`] as { status?: number; body: unknown };
        return { ok: true, status: reply.status ?? 200, json: async () => reply.body };
      }),
    );
    renderEntry("/create", { signedInAs: [siaya] });
    await fillCreateForm("Kisumu hub");
    await pressCreate();
    await screen.findByLabelText("Email");
    await userEvent.type(screen.getByLabelText("Email"), manager.email);
    await userEvent.type(screen.getByLabelText("Password"), manager.password);
    await pressCreate();
    await openStatus();
    await waitFor(() => expect(whereNow()).toHaveTextContent("/h/kisumu/status"));
    expect(pathsOf(calls)).toEqual([
      "GET /services",
      "POST /auth/signin",
      "GET /services",
      "GET /templates/siaya-lab.json",
      "POST /instances/import",
    ]);
    expect(screen.getByTestId("session")).toHaveTextContent("in:siaya,kisumu");
  });

  it("shows wakala's words for a visitor whose sign-in is refused and goes no further", async () => {
    const calls = stubFetch({
      "POST /auth/signin": { status: 401, body: { error: "that email address and password do not match a sign-in" } },
      ...goodServices,
    });
    renderEntry("/create");
    await fillCreateForm("Kisumu hub", manager);
    await pressCreate();
    expect(await screen.findByRole("alert")).toHaveTextContent("that email address and password do not match a sign-in");
    expect(pathsOf(calls)).toEqual(["POST /auth/signin"]);
    expect(screen.getByTestId("session")).toHaveTextContent("out");
  });

  it("shows wakala's words when the import is refused and connects nothing", async () => {
    stubFetch({ ...goodServices, "POST /instances/import": { status: 400, body: { error: "name must not be empty" } } });
    const tools = stubTools();
    renderEntry("/create", { signedInAs: [siaya] });
    await fillCreateForm("Kisumu hub");
    await pressCreate();
    expect(await screen.findByRole("alert")).toHaveTextContent("name must not be empty");
    expect(tools).toEqual([]);
    expect(screen.getByTestId("session")).toHaveTextContent("in:siaya");
  });

  it("says the template could not be loaded when the bundle does not hold it", async () => {
    const calls = stubFetch({ ...goodServices, "GET /templates/siaya-lab.json": { status: 404 } });
    renderEntry("/create", { signedInAs: [siaya] });
    await fillCreateForm("Kisumu hub");
    await pressCreate();
    expect(await screen.findByRole("alert")).toHaveTextContent("The hub template could not be loaded.");
    expect(pathsOf(calls)).toEqual(["GET /services", "GET /templates/siaya-lab.json"]);
  });

  it("says the agent was not connected when the hub has no Hub Steward role", async () => {
    stubFetch(goodServices);
    stubTools({ agency_list_roles: () => ({ items: [{ id: "r-1", name: "Hub manager" }] }) });
    renderEntry("/create", { signedInAs: [siaya] });
    await fillCreateForm("Kisumu hub");
    await pressCreate();
    expect(await screen.findByRole("alert")).toHaveTextContent("The hub has no Hub Steward role, so the agent was not connected.");
    expect(screen.getByTestId("session")).toHaveTextContent("in:siaya");
  });

  it("says the agent was not connected when the hub has no draft at all", async () => {
    stubFetch(goodServices);
    stubTools({ agency_list_drafts: () => ({ items: [] }) });
    renderEntry("/create", { signedInAs: [siaya] });
    await fillCreateForm("Kisumu hub");
    await pressCreate();
    expect(await screen.findByRole("alert")).toHaveTextContent("The hub has no Hub Steward role");
  });

  it("says Hub Steward could not be linked when the grant is refused, and creates no rooms", async () => {
    stubFetch(goodServices);
    const tools = stubTools({ agency_grant_service: () => new McpError("agency_grant_service: no such service") });
    renderEntry("/create", { signedInAs: [siaya] });
    await fillCreateForm("Kisumu hub");
    await pressCreate();
    expect(await screen.findByRole("alert")).toHaveTextContent("Hub Steward could not be linked to its role in the hub.");
    expect(toolNames(tools)).not.toContain("actor_create_group");
    expect(screen.getByTestId("session")).toHaveTextContent("in:siaya");
  });

  it("says the rooms could not be created when a room is refused", async () => {
    stubFetch(goodServices);
    stubTools({ actor_create_group: () => new McpError("actor_create_group: refused") });
    renderEntry("/create", { signedInAs: [siaya] });
    await fillCreateForm("Kisumu hub");
    await pressCreate();
    expect(await screen.findByRole("alert")).toHaveTextContent("The hub's rooms could not be created.");
  });

  it("says the rooms could not be created when a room comes back without an id", async () => {
    stubFetch(goodServices);
    stubTools({ actor_create_group: () => ({}) });
    renderEntry("/create", { signedInAs: [siaya] });
    await fillCreateForm("Kisumu hub");
    await pressCreate();
    expect(await screen.findByRole("alert")).toHaveTextContent("The hub's rooms could not be created.");
  });

  it("asks for the credentials when wakala's tools say the session is gone", async () => {
    stubFetch(goodServices);
    stubTools({ agency_list_drafts: () => new McpError("not signed in", true) });
    renderEntry("/create", { signedInAs: [siaya] });
    await fillCreateForm("Kisumu hub");
    await pressCreate();
    await screen.findByRole("alert");
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
  });

  it("asks for a hub name before anything is sent", async () => {
    const calls = stubFetch({ ...visitorCanSignIn, ...goodServices });
    renderEntry("/create");
    await pressCreate();
    expect(await screen.findByRole("alert")).toHaveTextContent("A hub name is required.");
    expect(calls).toEqual([]);
    expect(screen.getByTestId("session")).toHaveTextContent("out");
  });

  it("treats a name of only spaces as no name", async () => {
    const calls = stubFetch(goodServices);
    renderEntry("/create", { signedInAs: [siaya] });
    await fillCreateForm("   ");
    await pressCreate();
    expect(await screen.findByRole("alert")).toHaveTextContent("A hub name is required.");
    expect(calls).toEqual([]);
  });

  it("says the change could not be sent when wakala cannot be reached", async () => {
    stubFetch({ "POST /auth/signin": "unreachable" });
    renderEntry("/create");
    await fillCreateForm("Kisumu hub", manager);
    await pressCreate();
    expect(await screen.findByRole("alert")).toHaveTextContent("The change could not be sent.");
  });

  it("says the change could not be sent when the service list cannot be fetched", async () => {
    stubFetch({ ...goodServices, "GET /services": "unreachable" });
    renderEntry("/create", { signedInAs: [siaya] });
    await fillCreateForm("Kisumu hub");
    await pressCreate();
    expect(await screen.findByRole("alert")).toHaveTextContent("The change could not be sent.");
  });

  it("goes back to the start page with Back", async () => {
    renderEntry("/create");
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(await screen.findByRole("button", { name: "Log in" })).toBeInTheDocument();
  });
});

describe("the template choice on the create page", () => {
  it("offers the eight templates of the bundle with their roles and goals, the computer lab chosen", () => {
    renderEntry("/create");
    const group = screen.getByRole("radiogroup", { name: "Start from" });
    const radios = within(group).getAllByRole("radio");
    expect(radios.map((r) => (r as HTMLInputElement).value)).toEqual(["siaya-lab", "farmers", "boda-boda-riders", "logistics-freight-company", "agricultural-drone-crop-spraying-service", "clinical-research-organization", "electric-grid-utility", "mobile-money-operator"]);
    expect(within(group).getByLabelText(/Computer lab/)).toBeChecked();
    expect(within(group).getByText("3 roles · 4 goals")).toBeInTheDocument();
    expect(within(group).getByText("9 roles · 4 goals")).toBeInTheDocument();
    expect(within(group).getByText("7 roles · 4 goals")).toBeInTheDocument();
    expect(within(group).getByLabelText(/Freight and logistics/)).toBeInTheDocument();
    expect(within(group).getByLabelText(/Drone crop spraying/)).toBeInTheDocument();
    expect(within(group).getByLabelText(/Clinical research/)).toBeInTheDocument();
    expect(within(group).getByLabelText(/Electric grid utility/)).toBeInTheDocument();
    expect(within(group).getByLabelText(/Mobile money operator/)).toBeInTheDocument();
  });

  it("starts from the template the deployment names when the bundle has it", async () => {
    setRuntimeConfig({ wakala: "https://wakala.test", mcp: "https://wakala.test/mcp", template: "boda-boda-riders" });
    renderEntry("/create");
    await waitFor(() => expect(screen.getByLabelText(/Boda boda riders/)).toBeChecked());
  });

  it("starts from the first template when the deployment names one the bundle lacks", async () => {
    setRuntimeConfig({ wakala: "https://wakala.test", mcp: "https://wakala.test/mcp", template: "elsewhere" });
    renderEntry("/create");
    await waitFor(() => expect(screen.getByLabelText(/Computer lab/)).toBeChecked());
  });

  it("imports the template the manager chose, under the name typed", async () => {
    const calls = stubFetch({
      ...visitorCanSignIn,
      ...goodServices,
      "GET /templates/farmers.json": { body: { ...template, agency: { name: "Siaya Farmers' Group" } } },
    });
    renderEntry("/create");
    await userEvent.click(screen.getByLabelText(/Farmers' group/));
    expect(screen.getByLabelText(/Farmers' group/)).toBeChecked();
    expect(screen.getByLabelText(/Computer lab/)).not.toBeChecked();
    await fillCreateForm("Kisumu hub", manager);
    await pressCreate();
    await screen.findByRole("button", { name: "Open Status" });
    expect(pathsOf(calls)).toEqual(["POST /auth/signin", "GET /services", "GET /templates/farmers.json", "POST /instances/import"]);
    expect(calls.find((c) => c.path === "/instances/import")?.body).toMatchObject({ agency: { name: "Siaya Farmers' Group" }, name: "Kisumu hub" });
  });
});

describe("creating the hub, step by step", () => {
  it("shows the first step done and the next one running while the agent is being connected", async () => {
    stubFetch({ ...visitorCanSignIn, ...goodServices });
    let release: () => void = () => {};
    const held = new Promise((resolve) => {
      release = () => resolve({ instance_id: "kisumu" });
    });
    stubTools({ agency_grant_service: () => held });
    renderEntry("/create");
    await fillCreateForm("Kisumu hub", manager);
    await pressCreate();
    expect(await screen.findByRole("heading", { name: "Creating your hub" })).toBeInTheDocument();
    expect(await screen.findByText("Running")).toBeInTheDocument();
    expect(screen.getByText("1 of 3")).toBeInTheDocument();
    expect(screen.getByText("Kisumu hub · 3 roles · 4 goals")).toBeInTheDocument();
    expect(screen.getAllByText("Waiting")).toHaveLength(1);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "33");
    expect(screen.queryByLabelText("Hub name")).not.toBeInTheDocument();
    release();
    await screen.findByRole("button", { name: "Open Status" });
  });

  it("says the hub is ready, lists the three steps done and opens the status page from Open Status", async () => {
    stubFetch({ ...visitorCanSignIn, ...goodServices });
    renderEntry("/create");
    await fillCreateForm("Kisumu hub", manager);
    await pressCreate();
    expect(await screen.findByRole("heading", { name: "Your hub is ready" })).toBeInTheDocument();
    expect(screen.getByText("Importing the agency template")).toBeInTheDocument();
    expect(screen.getByText("Connecting Hub Steward to the hub")).toBeInTheDocument();
    expect(screen.getByText("agent, connected")).toBeInTheDocument();
    expect(screen.getByText("Creating the groups")).toBeInTheDocument();
    expect(screen.getByText("Managers' room, Farmers' room, Suppliers' room")).toBeInTheDocument();
    expect(whereNow).toThrow();
    await userEvent.click(screen.getByRole("button", { name: "Open Status" }));
    await waitFor(() => expect(whereNow()).toHaveTextContent("/h/kisumu/status"));
  });

  it("shows the step that failed once the hub exists, keeps the manager's other hubs and offers Back and Your hubs", async () => {
    stubFetch(goodServices);
    stubTools({ agency_grant_service: () => new McpError("agency_grant_service: no such service") });
    renderEntry("/create", { signedInAs: [siaya] });
    await fillCreateForm("Kisumu hub");
    await pressCreate();
    expect(await screen.findByRole("alert")).toHaveTextContent("Hub Steward could not be linked to its role in the hub.");
    expect(screen.getByRole("heading", { name: "Creating your hub" })).toBeInTheDocument();
    expect(screen.getByText("Failed")).toBeInTheDocument();
    expect(screen.getByText("1 of 3")).toBeInTheDocument();
    expect(screen.getByText("Kisumu hub · 3 roles · 4 goals")).toBeInTheDocument();
    expect(screen.getByText("Connecting Hub Steward to the hub").closest("li")).toHaveAttribute("aria-current", "step");
    expect(screen.queryByRole("button", { name: "Open Status" })).not.toBeInTheDocument();
    expect(screen.getByTestId("session")).toHaveTextContent("in:siaya");
  });

  it("goes back to the form with the name kept from the failed step", async () => {
    stubFetch(goodServices);
    stubTools({ agency_grant_service: () => new McpError("agency_grant_service: no such service") });
    renderEntry("/create", { signedInAs: [siaya] });
    await fillCreateForm("Kisumu hub");
    await pressCreate();
    await screen.findByRole("alert");
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByLabelText("Hub name")).toHaveValue("Kisumu hub");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("opens the list of hubs from Your hubs on the failed step", async () => {
    stubFetch(goodServices);
    stubTools({ agency_grant_service: () => new McpError("agency_grant_service: no such service") });
    renderEntry("/create", { signedInAs: [siaya] });
    await fillCreateForm("Kisumu hub");
    await pressCreate();
    await screen.findByRole("alert");
    await userEvent.click(screen.getByRole("button", { name: "Your hubs" }));
    expect(whereNow()).toHaveTextContent("/hubs");
  });

  it("returns to the form with the error under it when the failure comes before the hub exists", async () => {
    stubFetch({ ...goodServices, "GET /services": { body: [] } });
    renderEntry("/create", { signedInAs: [siaya] });
    await fillCreateForm("Kisumu hub");
    await pressCreate();
    expect(await screen.findByRole("alert")).toHaveTextContent("Hub Steward is not available on this server yet");
    expect(screen.getByLabelText("Hub name")).toHaveValue("Kisumu hub");
    expect(screen.queryByText("Failed")).not.toBeInTheDocument();
  });
});

describe("your hubs", () => {
  const hubsFetch = (extra: Record<string, Reply> = {}) =>
    stubFetch({
      "GET /auth/session": { body: {} },
      "GET /instances": { body: [membership(siaya), membership(kisumu)] },
      ...extra,
    });

  const renderHubs = () => {
    render(
      <I18nProvider initial={words}>
        <SessionProvider>
          <MemoryRouter initialEntries={["/hubs"]}>
            <Routes>
              <Route path="/hubs" element={<Hubs />} />
              <Route path="*" element={<Where />} />
            </Routes>
            <Session />
          </MemoryRouter>
        </SessionProvider>
      </I18nProvider>,
    );
  };

  const accountsOf = (keyed: Record<string, boolean | "unreadable">) =>
    callToolMock.mockImplementation(async (hubId: string, tool: string) => {
      if (tool !== "ai_list_accounts") throw new McpError(`unexpected tool ${tool}`);
      if (keyed[hubId] === "unreadable") throw new McpError("wakala answered 500: down");
      return { items: [{ id: "a1", name: "Model", provider: "anthropic", base_url: "https://api.anthropic.com", model_name: "claude-sonnet-5-5", status: "enabled", key_set: keyed[hubId] === true }] };
    });

  const cardOf = (name: string) => within(screen.getByRole("heading", { name }).closest(".card") as HTMLElement);

  it("draws a card for each hub the manager owns, with its role, a state and a model key that read Setting up and not set until the hub's models are read, and a New hub tile", async () => {
    hubsFetch();
    renderHubs();
    expect(await screen.findByRole("heading", { name: "Siaya hub" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Your hubs" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Kisumu hub" })).toBeInTheDocument();
    expect(screen.getAllByText("Setting up")).toHaveLength(2);
    expect(screen.getAllByText("owner")).toHaveLength(2);
    expect(screen.getAllByText("not set")).toHaveLength(2);
    expect(screen.getByRole("link", { name: "New hub" })).toHaveAttribute("href", "/create");
    expect(screen.getByTestId("session")).toHaveTextContent("in:siaya,kisumu");
  });

  it("reads Ready and set on the card of a hub whose models hold a key, and Setting up and not set on the card of one whose models hold none", async () => {
    hubsFetch();
    accountsOf({ siaya: true, kisumu: false });
    renderHubs();
    await screen.findByRole("heading", { name: "Siaya hub" });

    await waitFor(() => expect(cardOf("Siaya hub").getByText("Ready")).toBeInTheDocument());
    expect(cardOf("Siaya hub").getByText("set")).toBeInTheDocument();
    expect(cardOf("Kisumu hub").getByText("Setting up")).toBeInTheDocument();
    expect(cardOf("Kisumu hub").getByText("not set")).toBeInTheDocument();
  });

  it("reads the models of each listed hub once", async () => {
    hubsFetch();
    accountsOf({ siaya: true, kisumu: true });
    renderHubs();
    await waitFor(() => expect(screen.getAllByText("Ready")).toHaveLength(2));

    const reads = callToolMock.mock.calls.filter((call) => call[1] === "ai_list_accounts");
    expect(reads.map((call) => call[0])).toEqual(["siaya", "kisumu"]);
  });

  it("leaves the card of a hub as it is when its models cannot be read, and still reads the others", async () => {
    hubsFetch();
    accountsOf({ siaya: "unreadable", kisumu: true });
    renderHubs();
    await screen.findByRole("heading", { name: "Siaya hub" });

    await waitFor(() => expect(cardOf("Kisumu hub").getByText("Ready")).toBeInTheDocument());
    expect(cardOf("Siaya hub").getByText("Setting up")).toBeInTheDocument();
    expect(cardOf("Siaya hub").getByText("not set")).toBeInTheDocument();
  });

  it("shows the kind of each hub as a chip, and a glyph for it, when the hub has one", async () => {
    hubsFetch({
      "GET /instances": { body: [{ ...membership(siaya), kind: "Farmers' group" }, membership(kisumu)] },
    });
    renderHubs();
    await screen.findByRole("heading", { name: "Siaya hub" });
    expect(screen.getAllByText("Farmers")).toHaveLength(1);
    expect(screen.queryByText("Lab")).not.toBeInTheDocument();
    const cards = screen.getAllByRole("heading", { level: 3 }).map((h) => h.closest(".card"));
    expect(cards[0]?.querySelector(".glyph")).not.toBeNull();
  });

  it("opens a hub's status page from its Open link", async () => {
    hubsFetch();
    renderHubs();
    await screen.findByRole("heading", { name: "Siaya hub" });
    const links = screen.getAllByRole("link", { name: "Open" });
    expect(links.map((l) => l.getAttribute("href"))).toEqual(["/h/siaya/status", "/h/kisumu/status"]);
  });

  it("says the manager runs no hub yet and offers to create one", async () => {
    hubsFetch({ "GET /instances": { body: [] } });
    renderHubs();
    expect(await screen.findByText("You do not run a hub yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create a hub" })).toHaveAttribute("href", "/create");
    expect(screen.queryByRole("link", { name: "New hub" })).not.toBeInTheDocument();
  });

  it("says the page could not be loaded when the hubs cannot be listed, and tries again", async () => {
    const calls = hubsFetch({ "GET /instances": { status: 500 } });
    renderHubs();
    expect(await screen.findByRole("alert")).toHaveTextContent("The page could not be loaded.");
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(calls.filter((c) => c.path === "/instances")).toHaveLength(2));
  });

  it("sends a visitor who is not signed in to the start page", async () => {
    stubFetch({ "GET /auth/session": { status: 401, body: { error: "not signed in" } } });
    renderHubs();
    await waitFor(() => expect(whereNow()).toHaveTextContent("/start"));
  });

  it("signs the manager out and returns to the start page from Sign out", async () => {
    const calls = hubsFetch({ "POST /auth/signout": { body: {} } });
    renderHubs();
    await screen.findByRole("heading", { name: "Siaya hub" });
    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(whereNow()).toHaveTextContent("/start"));
    expect(pathsOf(calls)).toContain("POST /auth/signout");
    expect(screen.getByTestId("session")).toHaveTextContent("out");
  });
});
