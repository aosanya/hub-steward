import {
  act,
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { StrictMode, useEffect, useState, type ReactNode } from "react";
import {
  Link,
  MemoryRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../i18n";
import { SessionProvider, useSession } from "../session";
import type { Reply } from "../data/chatAnswer";
import { askModel } from "../data/modelChat";
import type { Hub } from "../types";
import { McpError, callTool } from "../wakala/mcp";
import { useConsole } from "./context";
import { Frame } from "./Frame";
import { saveTheme } from "./theme";

vi.mock("../wakala/mcp", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  callTool: vi.fn(),
}));

vi.mock("../data/modelChat", () => ({ askModel: vi.fn() }));

const callToolMock = vi.mocked(callTool);
const askModelMock = vi.mocked(askModel);

const words = JSON.parse(
  readFileSync(resolve(__dirname, "../../public/i18n.json"), "utf8"),
);

const lab: Hub = {
  id: "siaya",
  name: "Siaya Community Computer Lab",
  role: "owner",
  kind: "community computer lab",
  model_key_set: true,
};
const farmers: Hub = {
  id: "kisumu",
  name: "Kisumu Farmers' Group",
  role: "owner",
  kind: "farmers' group",
  model_key_set: false,
};
const riders: Hub = {
  id: "nairobi",
  name: "Nairobi Boda Boda Riders",
  role: "owner",
  kind: "boda boda riders' group",
  model_key_set: true,
};

const hubs = [lab, farmers, riders];

type Call = { method: string; path: string };

type BackendOptions = {
  signedIn?: boolean;
  pending?: number;
  approvalsDown?: boolean;
  noModel?: boolean;
};

const chatModel = {
  id: "a-1",
  name: "Muse Spark",
  status: "enabled",
  chat_enabled: true,
  chat_label: "Muse Spark 1.3",
};

const answerOf = "Add one on the Models page.";

function startBackend(options: BackendOptions = {}) {
  const calls: Call[] = [];
  let pending = options.pending ?? 0;
  const reply = (data: unknown, status = 200) => ({
    ok: status < 400,
    status,
    json: async () => data,
  });
  const memberships = hubs.map((hub) => ({
    id: hub.id,
    name: hub.name,
    role: "owner",
    kind: hub.kind,
  }));

  const answer = async (call: Call) => {
    const key = `${call.method} ${call.path}`;
    if (key === "GET /auth/session")
      return options.signedIn === false
        ? reply({ error: "not signed in" }, 401)
        : reply({ member_id: "m-1" });
    if (key === "GET /instances") return reply(memberships);
    if (key === "POST /auth/signout") return reply({}, 204);
    return reply({}, 404);
  };

  const fetchStub = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const call: Call = {
        method: init?.method ?? "GET",
        path: new URL(String(input), "http://console.test").pathname,
      };
      calls.push(call);
      return answer(call);
    },
  );
  vi.stubGlobal("fetch", fetchStub);

  const unavailable = () => new McpError("wakala answered 500: down");
  const tools: Record<
    string,
    (args: Record<string, unknown>, hubId: string) => Promise<unknown>
  > = {
    ai_list_accounts: async (_args, hubId) => ({
      items: options.noModel
        ? []
        : [
            {
              ...chatModel,
              key_set:
                hubs.find((hub) => hub.id === hubId)?.model_key_set === true,
            },
          ],
    }),
    agency_list_approvals: async () => {
      if (options.approvalsDown) throw unavailable();
      return {
        items: Array.from({ length: pending }, (_, i) => ({ id: `ap-${i}` })),
      };
    },
  };
  askModelMock.mockReset();
  askModelMock.mockResolvedValue({ text: answerOf, calls: [] });
  callToolMock.mockReset();
  callToolMock.mockImplementation(
    async (hubId: string, tool: string, args: Record<string, unknown> = {}) => {
      if (!(tool in tools)) throw new McpError(`unexpected tool ${tool}`);
      return tools[tool](args, hubId);
    },
  );

  const callsTo = (path: string, method = "GET") =>
    calls.filter((c) => c.path === path && c.method === method);
  const toolCallsTo = (tool: string) =>
    callToolMock.mock.calls.filter((call) => call[1] === tool);
  return {
    callsTo,
    toolCallsTo,
    setPending: (count: number) => {
      pending = count;
    },
  };
}

function Seed({ children }: { children: ReactNode }) {
  const { startSession } = useSession();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    startSession(hubs);
    setReady(true);
  }, [startSession]);
  return ready ? <>{children}</> : null;
}

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

function ModelsStub() {
  const { hub } = useConsole();
  return (
    <section>
      <h1>Models page of {hub.name}</h1>
      <Link to={`/h/${hub.id}/groups`}>go to groups</Link>
    </section>
  );
}

function GroupsStub() {
  const { page, setBadges, refreshMenu } = useConsole();
  useEffect(() => setBadges({ groups: 3 }), [setBadges]);
  return (
    <section>
      <h1>Groups page ({page})</h1>
      <button type="button" onClick={() => setBadges({ groups: 3 })}>
        report the same counts
      </button>
      <button type="button" onClick={refreshMenu}>
        refresh the menu
      </button>
    </section>
  );
}

function PlainStub() {
  return <h1>Plain page {useConsole().page}</h1>;
}

function Routing() {
  return (
    <Routes>
      <Route path="/" element={<p>front door</p>} />
      <Route path="/start" element={<p>start page</p>} />
      <Route path="/login" element={<p>sign-in page</p>} />
      <Route path="/create" element={<p>create page</p>} />
      <Route path="/h/:hubId" element={<Frame />}>
        <Route index element={<Navigate to="status" replace />} />
        <Route path="models" element={<ModelsStub />} />
        <Route path="groups" element={<GroupsStub />} />
        <Route path="approvals/:tab" element={<PlainStub />} />
        <Route path="agent-edit/:role/:tab" element={<PlainStub />} />
        <Route path=":page" element={<PlainStub />} />
      </Route>
    </Routes>
  );
}

function openConsole(at: string, { signedIn = true, strict = false } = {}) {
  const tree = (
    <>
      <Routing />
      <Where />
    </>
  );
  const app = (
    <MemoryRouter initialEntries={[at]}>
      <I18nProvider initial={words}>
        <SessionProvider>
          {signedIn ? <Seed>{tree}</Seed> : tree}
        </SessionProvider>
      </I18nProvider>
    </MemoryRouter>
  );
  return render(strict ? <StrictMode>{app}</StrictMode> : app);
}

const root = () => document.querySelector(".app") as HTMLElement;
const strip = () => document.querySelector(".strip") as HTMLElement;
const columns = () => document.querySelector(".cols") as HTMLElement;
const menu = () => screen.getByRole("navigation", { name: "Menu" });
const chat = () => screen.getByRole("complementary");
const composer = () =>
  within(chat()).getByRole("textbox", { name: "Write a message" });
const collapseButton = () =>
  within(chat()).getByRole("button", { name: "Collapse chat" });
const openButton = () =>
  within(chat()).getByRole("button", { name: "Open chat" });
const crumb = () => strip().querySelector(".crumb") as HTMLElement;
const switcher = (name: RegExp) =>
  within(strip()).getByRole("button", { name });
const labSwitcher = () => switcher(/Siaya Community Computer Lab/);

const modelsOfLab = async () => {
  await screen.findByRole("heading", {
    name: "Models page of Siaya Community Computer Lab",
  });
};

const openSwitcher = async (
  user: ReturnType<typeof userEvent.setup>,
  name: RegExp,
) => {
  await user.click(switcher(name));
  return document.querySelector(".drop") as HTMLElement;
};

beforeEach(() => {
  saveTheme("dark");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  localStorage.clear();
  window.innerWidth = 1024;
});

describe("the console shell", () => {
  it("shows the header strip, the menu and the chat column around the page of the route", async () => {
    startBackend();
    openConsole("/h/siaya/models");

    const page = await screen.findByRole("heading", {
      name: "Models page of Siaya Community Computer Lab",
    });
    expect(screen.getByRole("main")).toContainElement(page);
    expect(within(strip()).getByText("Hub Steward")).toBeInTheDocument();
    expect(within(strip()).getByText("Demo")).toBeInTheDocument();
    expect(within(menu()).getByText("Agency")).toBeInTheDocument();
    expect(
      within(menu()).getByRole("link", { name: "Profile" }),
    ).toBeInTheDocument();
    expect(
      within(chat()).getByRole("heading", { name: "Chat", level: 2 }),
    ).toBeInTheDocument();
  });

  it("puts the strip on top and the menu, the page and the chat column side by side under it, all inside the themed frame", async () => {
    startBackend();
    openConsole("/h/siaya/models");

    await modelsOfLab();
    expect(root()).toHaveClass("app", "console");
    expect(root().children[0]).toBe(strip());
    expect(root().children[1]).toBe(columns());
    expect([...columns().children]).toEqual([
      menu(),
      screen.getByRole("main"),
      chat(),
    ]);
  });

  it("names the page from the first path segment after the hub", async () => {
    const backend = startBackend();
    openConsole("/h/siaya/approvals/pending");

    expect(
      await screen.findByRole("heading", { name: "Plain page approvals" }),
    ).toBeInTheDocument();
    expect(crumb()).toHaveTextContent("Generated / Approvals");
    expect(within(chat()).getByText("Approvals")).toBeInTheDocument();
    expect(
      within(menu()).getByRole("link", { name: /^Approvals/ }),
    ).toHaveAttribute("aria-current", "page");
    expect(backend.toolCallsTo("agency_list_approvals")).toHaveLength(0);
  });

  it("lands on Status when the address names no page", async () => {
    startBackend();
    openConsole("/h/siaya");

    expect(
      await screen.findByRole("heading", { name: "Plain page status" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("where")).toHaveTextContent("/h/siaya/status");
    expect(crumb()).toHaveTextContent("Status");
    expect(crumb()).not.toHaveTextContent("/");
  });
});

describe("the strip", () => {
  it("shows the hub chip with the initials, the name, whether the hub is ready or setting up and its kind", async () => {
    startBackend();
    openConsole("/h/siaya/models");

    await modelsOfLab();
    expect(labSwitcher()).toHaveTextContent("SC");
    expect(labSwitcher()).toHaveTextContent("Siaya Community Computer Lab");
    expect(labSwitcher()).toHaveTextContent("Ready");
    expect(labSwitcher()).toHaveTextContent("Lab");
    expect(labSwitcher().querySelector(".dot")).toHaveClass("ok");
    expect(labSwitcher()).toHaveAttribute("aria-haspopup", "true");
    expect(labSwitcher()).toHaveAttribute("aria-expanded", "false");
  });

  it("says a hub without a model key is setting up and a farmers' group is Farmers", async () => {
    startBackend();
    openConsole("/h/kisumu/models");

    await screen.findByRole("heading", {
      name: "Models page of Kisumu Farmers' Group",
    });
    const chip = switcher(/Kisumu Farmers' Group/);
    expect(chip).toHaveTextContent("Setting up");
    expect(chip).toHaveTextContent("Farmers");
    expect(chip.querySelector(".dot")).not.toHaveClass("ok");
  });

  it("draws the crumb as the section, then the page, and links the parent page of a sub-menu page", async () => {
    startBackend();
    openConsole("/h/siaya/network");

    await screen.findByRole("heading", { name: "Plain page network" });
    expect(crumb()).toHaveTextContent("Generated / Operations / Network");
    expect(
      within(crumb()).getByRole("link", { name: "Operations" }),
    ).toHaveAttribute("href", "/h/siaya/operations");
    expect(crumb().querySelector(".crumb-now")).toHaveTextContent("Network");
  });

  it("draws the crumb of a settings page as Settings / Models", async () => {
    startBackend();
    openConsole("/h/siaya/models");

    await modelsOfLab();
    expect(crumb()).toHaveTextContent("Settings / Models");
  });

  it("offers the six languages by name in a select with a globe and marks the current one", async () => {
    startBackend();
    openConsole("/h/siaya/models");

    await modelsOfLab();
    const select = within(strip()).getByRole("combobox", { name: "Language" });
    expect(
      within(select)
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual([
      "English",
      "Deutsch",
      "Kiswahili",
      "Español",
      "Français",
      "中文",
    ]);
    expect(select).toHaveValue("en");
    expect(select.closest("label")?.querySelector("svg")).not.toBeNull();
    expect(
      within(strip()).queryAllByRole("button", {
        name: /^(en|de|sw|es|fr|zh)$/,
      }),
    ).toHaveLength(0);
  });

  it("switches the words of the strip, the menu and the chat when another language is chosen and remembers it", async () => {
    startBackend();
    const user = userEvent.setup();
    openConsole("/h/siaya/models");

    await modelsOfLab();
    await user.selectOptions(
      within(strip()).getByRole("combobox", { name: "Language" }),
      "de",
    );

    expect(
      within(screen.getByRole("navigation", { name: "Menü" })).getByText(
        "Nutzer & Agenten",
      ),
    ).toBeInTheDocument();
    expect(
      within(chat()).getByRole("heading", { name: "Chat" }),
    ).toBeInTheDocument();
    expect(
      within(chat()).getByText("Was möchtest du bei Modelle tun?"),
    ).toBeInTheDocument();
    expect(
      within(strip()).getByRole("combobox", { name: "Sprache" }),
    ).toHaveValue("de");
    expect(localStorage.getItem("lang")).toBe("de");
  });
});

describe("the hub switcher", () => {
  it("opens with a search, the manager's hubs and New hub, each hub with its initials, state and kind", async () => {
    startBackend();
    const user = userEvent.setup();
    openConsole("/h/siaya/models");
    await modelsOfLab();

    const drop = within(
      await openSwitcher(user, /Siaya Community Computer Lab/),
    );

    expect(labSwitcher()).toHaveAttribute("aria-expanded", "true");
    expect(
      drop.getByRole("searchbox", { name: "Find a hub" }),
    ).toBeInTheDocument();
    expect(drop.getByText("Your hubs")).toBeInTheDocument();
    expect(
      drop.getByRole("link", { name: /Kisumu Farmers' Group/ }),
    ).toHaveTextContent("KF");
    expect(
      drop.getByRole("link", { name: /Kisumu Farmers' Group/ }),
    ).toHaveTextContent("Setting up");
    expect(
      drop.getByRole("link", { name: /Kisumu Farmers' Group/ }),
    ).toHaveTextContent("Farmers");
    expect(
      drop.getByRole("link", { name: /Nairobi Boda Boda Riders/ }),
    ).toHaveTextContent("Ready");
    expect(
      drop.getByRole("link", { name: /Nairobi Boda Boda Riders/ }),
    ).toHaveTextContent("Riders");
    expect(drop.getByRole("link", { name: "New hub" })).toHaveAttribute(
      "href",
      "/create",
    );
  });

  it("marks the open hub with a check and offers Open on each other hub", async () => {
    startBackend();
    const user = userEvent.setup();
    openConsole("/h/siaya/models");
    await modelsOfLab();

    const drop = within(
      await openSwitcher(user, /Siaya Community Computer Lab/),
    );

    expect(
      drop.getByRole("link", { name: /Siaya Community Computer Lab/ }),
    ).toHaveAttribute("aria-current", "true");
    expect(
      drop
        .getByRole("link", { name: /Siaya Community Computer Lab/ })
        .querySelector(".tick"),
    ).not.toBeNull();
    expect(
      drop.getByRole("link", { name: /Kisumu Farmers' Group/ }),
    ).not.toHaveAttribute("aria-current");
    expect(
      drop.getByRole("link", { name: /Kisumu Farmers' Group/ }),
    ).toHaveTextContent("Open");
    expect(drop.getAllByText("Open")).toHaveLength(2);
  });

  it("narrows the list to the hubs whose name holds what is typed and always keeps the open hub", async () => {
    startBackend();
    const user = userEvent.setup();
    openConsole("/h/siaya/models");
    await modelsOfLab();
    const drop = within(
      await openSwitcher(user, /Siaya Community Computer Lab/),
    );

    await user.type(
      drop.getByRole("searchbox", { name: "Find a hub" }),
      "boda",
    );

    expect(
      drop.getByRole("link", { name: /Nairobi Boda Boda Riders/ }),
    ).toBeInTheDocument();
    expect(
      drop.queryByRole("link", { name: /Kisumu Farmers' Group/ }),
    ).not.toBeInTheDocument();
    expect(
      drop.getByRole("link", { name: /Siaya Community Computer Lab/ }),
    ).toBeInTheDocument();
  });

  it("opens the same page of another hub when its row is pressed and starts an empty message box there", async () => {
    const backend = startBackend();
    const user = userEvent.setup();
    openConsole("/h/siaya/models");
    await modelsOfLab();
    await user.type(composer(), "for siaya");

    const drop = within(
      await openSwitcher(user, /Siaya Community Computer Lab/),
    );
    await user.click(drop.getByRole("link", { name: /Kisumu Farmers' Group/ }));

    expect(
      await screen.findByRole("heading", {
        name: "Models page of Kisumu Farmers' Group",
      }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("where")).toHaveTextContent("/h/kisumu/models");
    expect(document.querySelector(".drop")).toBeNull();
    expect(composer()).toHaveValue("");
    await waitFor(() =>
      expect(backend.toolCallsTo("ai_list_accounts").at(-1)?.[0]).toBe(
        "kisumu",
      ),
    );
    expect(switcher(/Kisumu Farmers' Group/)).toHaveTextContent("Setting up");
  });

  it("opens Status of a hub whose menu does not hold the page that is open", async () => {
    startBackend();
    const user = userEvent.setup();
    openConsole("/h/siaya/approvals/pending");
    await screen.findByRole("heading", { name: "Plain page approvals" });

    const drop = within(
      await openSwitcher(user, /Siaya Community Computer Lab/),
    );
    await user.click(drop.getByRole("link", { name: /Kisumu Farmers' Group/ }));

    expect(
      await screen.findByRole("heading", { name: "Plain page status" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("where")).toHaveTextContent("/h/kisumu/status");
  });

  it("opens the Agents page of another hub from an agent's edit page, dropping the role and the tab", async () => {
    startBackend();
    const user = userEvent.setup();
    openConsole("/h/siaya/agent-edit/Assets%20Keeper/limits");
    await screen.findByRole("heading", { name: "Plain page agent-edit" });

    const drop = within(
      await openSwitcher(user, /Siaya Community Computer Lab/),
    );
    await user.click(
      drop.getByRole("link", { name: /Nairobi Boda Boda Riders/ }),
    );

    expect(
      await screen.findByRole("heading", { name: "Plain page agents" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("where")).toHaveTextContent("/h/nairobi/agents");
  });

  it("closes on Escape and gives the focus back to the chip", async () => {
    startBackend();
    const user = userEvent.setup();
    openConsole("/h/siaya/models");
    await modelsOfLab();
    await openSwitcher(user, /Siaya Community Computer Lab/);

    await user.keyboard("{Escape}");

    expect(document.querySelector(".drop")).toBeNull();
    expect(labSwitcher()).toHaveFocus();
  });

  it("closes when the page outside it is pressed and when the chip is pressed again", async () => {
    startBackend();
    const user = userEvent.setup();
    openConsole("/h/siaya/models");
    await modelsOfLab();

    await openSwitcher(user, /Siaya Community Computer Lab/);
    await user.click(screen.getByRole("main"));
    expect(document.querySelector(".drop")).toBeNull();

    await user.click(labSwitcher());
    await user.click(labSwitcher());
    expect(document.querySelector(".drop")).toBeNull();
  });

  it("goes to the create page from New hub", async () => {
    startBackend();
    const user = userEvent.setup();
    openConsole("/h/siaya/models");
    await modelsOfLab();

    const drop = within(
      await openSwitcher(user, /Siaya Community Computer Lab/),
    );
    await user.click(drop.getByRole("link", { name: "New hub" }));

    expect(await screen.findByText("create page")).toBeInTheDocument();
  });
});

describe("the menu", () => {
  it("shows a lab the sections Agency, Users & Agents, Generated, Knowledge and Settings under Status", async () => {
    startBackend();
    openConsole("/h/siaya/models");
    await modelsOfLab();

    const captions = [...menu().querySelectorAll(".eyebrow")].map(
      (node) => node.textContent,
    );
    expect(captions).toEqual([
      "Agency",
      "Users & Agents",
      "Generated",
      "Knowledge",
      "Settings",
    ]);
    expect(menu().querySelector(".menu-group")).toHaveTextContent("Status");
    for (const link of [
      "Profile",
      "Goals",
      "Roles",
      "Risks",
      "Users",
      "Groups",
      "Agents",
      "Approvals",
      "Operations",
      "Documents",
      "General",
      "Models",
    ]) {
      expect(
        within(menu()).getByRole("link", { name: new RegExp(`^${link}`) }),
      ).toBeInTheDocument();
    }
    for (const gone of [
      "Limits",
      "Overview",
      "Members",
      "Invite a user",
      "AI roles",
    ])
      expect(
        within(menu()).queryByRole("link", { name: gone }),
      ).not.toBeInTheDocument();
  });

  it("shows a farmers' group Workflows, Test and Publish, and no Market section, Approvals, Operations or Documents", async () => {
    startBackend();
    openConsole("/h/kisumu/models");
    await screen.findByRole("heading", {
      name: "Models page of Kisumu Farmers' Group",
    });

    expect(within(menu()).queryByText("Market")).not.toBeInTheDocument();
    for (const gone of ["Suppliers", "Products", "Group orders"])
      expect(
        within(menu()).queryByRole("link", { name: gone }),
      ).not.toBeInTheDocument();
    for (const shown of ["Workflows", "Test", "Publish"])
      expect(
        within(menu()).getByRole("link", { name: shown }),
      ).toBeInTheDocument();
    for (const gone of ["Farm orders", "Produce"])
      expect(
        within(menu()).queryByRole("link", { name: gone }),
      ).not.toBeInTheDocument();
    for (const gone of [
      "Approvals",
      "Operations",
      "Documents",
      "Equipment",
    ])
      expect(
        within(menu()).queryByRole("link", { name: gone }),
      ).not.toBeInTheDocument();
  });

  it("shows a riders' hub Equipment", async () => {
    startBackend();
    openConsole("/h/nairobi/models");
    await screen.findByRole("heading", {
      name: "Models page of Nairobi Boda Boda Riders",
    });

    expect(
      within(menu()).getByRole("link", { name: "Equipment" }),
    ).toBeInTheDocument();
    expect(
      within(menu()).queryByRole("link", { name: "Group orders" }),
    ).not.toBeInTheDocument();
  });

  it("marks the open row, gives every row an icon and links it to its page", async () => {
    startBackend();
    openConsole("/h/siaya/models");
    await modelsOfLab();

    const models = within(menu()).getByRole("link", { name: "Models" });
    expect(models).toHaveAttribute("aria-expanded", "true");
    expect(models).toHaveAttribute("href", "/h/siaya/models");
    expect(models.querySelector(".nav-icon svg")).not.toBeNull();
    const configure = within(menu()).getByRole("link", { name: "Configure" });
    expect(configure).toHaveAttribute("aria-current", "page");
    expect(configure).toHaveAttribute("href", "/h/siaya/models-configure");
    expect(
      within(menu()).getByRole("link", { name: "Goals" }),
    ).not.toHaveAttribute("aria-current");
    expect(within(menu()).getByRole("link", { name: "Users" })).toHaveAttribute(
      "href",
      "/h/siaya/users",
    );
  });

  it("opens the Operations sub-menu on one of its pages and leaves it closed elsewhere", async () => {
    startBackend();
    openConsole("/h/siaya/activity");
    await screen.findByRole("heading", { name: "Plain page activity" });

    const operations = within(menu()).getByRole("link", { name: "Operations" });
    expect(operations).toHaveAttribute("aria-expanded", "true");
    const activity = within(menu()).getByRole("link", { name: "Activity" });
    expect(activity).toHaveClass("sub");
    expect(activity).toHaveAttribute("aria-current", "page");
    expect(within(menu()).getByRole("link", { name: "Alerts" })).toHaveClass(
      "sub",
    );
  });

  it("keeps the Operations sub-menu closed while another page is open", async () => {
    startBackend();
    openConsole("/h/siaya/models");
    await modelsOfLab();

    expect(
      within(menu()).getByRole("link", { name: "Operations" }),
    ).toHaveAttribute("aria-expanded", "false");
    expect(
      within(menu()).queryByRole("link", { name: "Network" }),
    ).not.toBeInTheDocument();
  });

  it("puts no count on the Approvals row of a lab and does not ask for the pending list, since approvals are not in use", async () => {
    const backend = startBackend({ pending: 2 });
    openConsole("/h/siaya/models");
    await modelsOfLab();
    await act(async () => {});

    expect(
      within(menu()).getByRole("link", { name: /^Approvals/ }).querySelector(".nav-badge"),
    ).toBeNull();
    expect(backend.toolCallsTo("agency_list_approvals")).toHaveLength(0);
  });

  it("shows no count while nothing is pending and does not ask a farmers' group, which has no approvals", async () => {
    const backend = startBackend({ pending: 0 });
    openConsole("/h/kisumu/models");
    await screen.findByRole("heading", {
      name: "Models page of Kisumu Farmers' Group",
    });

    expect(menu().querySelector(".nav-badge")).toBeNull();
    expect(backend.toolCallsTo("agency_list_approvals")).toHaveLength(0);
  });

  it("shows the counts a page reports as badges on its row", async () => {
    startBackend();
    openConsole("/h/siaya/groups");

    const badge = await within(menu()).findByText("3");
    expect(badge).toHaveClass("nav-badge");
    expect(
      within(menu()).getByRole("link", { name: /^Groups/ }),
    ).toContainElement(badge);
  });

  it("ends the session and goes to the start page when Sign out is pressed", async () => {
    const backend = startBackend();
    const user = userEvent.setup();
    openConsole("/h/siaya/models");
    await modelsOfLab();

    await user.click(within(menu()).getByRole("link", { name: "Sign out" }));

    expect(await screen.findByText("start page")).toBeInTheDocument();
    expect(backend.callsTo("/auth/signout", "POST")).toHaveLength(1);
    expect(backend.callsTo("/instances")).toHaveLength(0);
    expect(screen.getByTestId("where")).toHaveTextContent("/start");
    expect(
      screen.queryByRole("navigation", { name: "Menu" }),
    ).not.toBeInTheDocument();
  });
});

describe("a review kept for the hub", () => {
  it("puts the tabs above the page's own header", async () => {
    startBackend();
    localStorage.setItem(
      "chat.review.siaya",
      JSON.stringify({
        hubId: "siaya",
        page: "groups",
        id: 1,
        fill: {
          page: "groups",
          summary: "s",
          items: [
            { title: "Rename", detail: "", tool: "", arguments: {}, then: [] },
          ],
        },
      }),
    );
    openConsole("/h/siaya/groups");
    await screen.findByRole("button", { name: "Chat response" });
    const tabs = document.querySelector(".review-tabs") as HTMLElement;

    await userEvent
      .setup()
      .click(within(tabs).getByRole("button", { name: "Groups" }));
    const header = await screen.findByRole("heading", {
      name: "Groups page (groups)",
    });

    expect(
      tabs.compareDocumentPosition(header) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});

describe("moving between pages", () => {
  it("keeps the frame, the strip, the menu and the chat column in place with the typed message, the rail and the thread untouched", async () => {
    startBackend();
    const user = userEvent.setup();
    openConsole("/h/siaya/models");
    await modelsOfLab();
    const before = {
      root: root(),
      strip: strip(),
      columns: columns(),
      menu: menu(),
      chat: chat(),
      chip: labSwitcher(),
      language: within(strip()).getByRole("combobox", { name: "Language" }),
    };
    await user.type(composer(), "half-written");
    await user.click(collapseButton());

    await user.click(screen.getByRole("link", { name: "go to groups" }));

    expect(
      await screen.findByRole("heading", { name: "Groups page (groups)" }),
    ).toBeInTheDocument();
    expect(root()).toBe(before.root);
    expect(strip()).toBe(before.strip);
    expect(columns()).toBe(before.columns);
    expect(menu()).toBe(before.menu);
    expect(chat()).toBe(before.chat);
    expect(labSwitcher()).toBe(before.chip);
    expect(within(strip()).getByRole("combobox", { name: "Language" })).toBe(
      before.language,
    );
    expect(chat()).toHaveClass("rail");
    expect(crumb()).toHaveTextContent("Users & Agents / Groups");

    await user.click(openButton());
    expect(composer()).toHaveValue("half-written");
    expect(within(chat()).getByText("Groups")).toBeInTheDocument();
  });

  it("marks the next page in the menu at once and keeps every other row where it was", async () => {
    startBackend();
    const user = userEvent.setup();
    openConsole("/h/siaya/models");
    await modelsOfLab();
    const folding = ["Configure", "Usage"];
    const links = within(menu())
      .getAllByRole("link")
      .filter((link) => !folding.includes(link.textContent ?? ""));

    await user.click(screen.getByRole("link", { name: "go to groups" }));
    await screen.findByRole("heading", { name: "Groups page (groups)" });

    expect(
      within(menu()).getByRole("link", { name: /^Groups/ }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      within(menu()).getByRole("link", { name: "Models" }),
    ).not.toHaveAttribute("aria-current");
    expect(
      within(menu()).getByRole("link", { name: "Sign out" }),
    ).toBeInTheDocument();
    expect(
      within(menu())
        .getAllByRole("link")
        .filter((link) => links.includes(link)),
    ).toHaveLength(links.length);
  });

});

const deferred = () => {
  let resolve: (answer: Reply) => void = () => {};
  let reject: (error: Error) => void = () => {};
  const promise = new Promise<Reply>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const typeMessage = async (
  user: ReturnType<typeof userEvent.setup>,
  text: string,
) =>
  user.type(
    await within(await screen.findByRole("complementary")).findByRole(
      "textbox",
      { name: "Write a message" },
    ),
    text,
  );

const chatReady = () =>
  waitFor(() =>
    expect(
      within(chat()).getByRole("button", { name: "Muse Spark 1.3" }),
    ).toBeInTheDocument(),
  );

describe("the chat column", () => {
  it("offers the hub's chat model in the box and asks nothing of any model until a message is sent", async () => {
    startBackend();
    openConsole("/h/siaya/models");

    await modelsOfLab();
    await chatReady();
    expect(askModelMock).not.toHaveBeenCalled();
  });

  it("greets the manager with the page, offers its three suggestions and asks about the page in the box", async () => {
    startBackend();
    openConsole("/h/siaya/models");

    const column = within(await screen.findByRole("complementary"));
    expect(
      await column.findByText("What would you like to do on Models?"),
    ).toBeInTheDocument();
    expect(
      await column.findByRole("button", { name: "Test the key" }),
    ).toBeInTheDocument();
    expect(
      column
        .getAllByRole("button", {
          name: /Add a Meta open weights model|Which agents use Muse Spark\?|Test the key/,
        })
        .map((b) => b.textContent),
    ).toEqual([
      "Add a Meta open weights model",
      "Which agents use Muse Spark?",
      "Test the key",
    ]);
    expect(
      column.getByText("Add a Meta open weights model").closest("button"),
    ).toHaveClass("sugg");
    expect(
      column.getByRole("textbox", { name: "Write a message" }),
    ).toHaveAttribute("placeholder", "Ask about Models…");
    expect(
      column.getByText("Models", { selector: ".chat-ctx" }),
    ).toBeInTheDocument();
    expect(
      column.getByRole("button", { name: "Attach a file" }),
    ).toBeInTheDocument();
    expect(column.getByRole("button", { name: "Send" })).toHaveAttribute(
      "type",
      "submit",
    );
  });

  it("offers only adding a model on the Models page while the hub has no model", async () => {
    const backend = startBackend({ noModel: true });
    openConsole("/h/siaya/models");

    const column = within(await screen.findByRole("complementary"));
    expect(
      await column.findByRole("button", {
        name: "Add a Meta open weights model",
      }),
    ).toHaveClass("sugg");
    await waitFor(() =>
      expect(backend.toolCallsTo("ai_list_accounts")).not.toHaveLength(0),
    );
    await act(async () => {});
    expect(
      column.queryByRole("button", { name: "Test the key" }),
    ).not.toBeInTheDocument();
    expect(
      column.queryByRole("button", { name: /Which agents use/ }),
    ).not.toBeInTheDocument();
    expect(chat().querySelectorAll(".sugg")).toHaveLength(1);
  });

  it("offers adding a model, its agents and its key once the hub has one model", async () => {
    startBackend();
    openConsole("/h/siaya/models");

    const column = within(await screen.findByRole("complementary"));
    expect(
      await column.findByRole("button", {
        name: "Which agents use Muse Spark?",
      }),
    ).toBeInTheDocument();
    expect(
      column.getByRole("button", { name: "Test the key" }),
    ).toBeInTheDocument();
    expect(
      column.getByRole("button", { name: "Add a Meta open weights model" }),
    ).toBeInTheDocument();
    expect(chat().querySelectorAll(".sugg")).toHaveLength(3);
  });

  it("offers the suggestions of the page that is open", async () => {
    startBackend();
    openConsole("/h/siaya/alerts");

    expect(
      await within(await screen.findByRole("complementary")).findByText(
        "What needs my attention?",
      ),
    ).toBeInTheDocument();
    expect(
      within(chat()).getByText("What would you like to do on Alerts?"),
    ).toBeInTheDocument();
    expect(
      within(chat()).getByRole("textbox", { name: "Write a message" }),
    ).toHaveAttribute("placeholder", "Ask about Alerts…");
  });

  it("offers no suggestion on a page that is held back from the menu", async () => {
    startBackend();
    openConsole("/h/siaya/network");

    expect(
      await within(await screen.findByRole("complementary")).findByText(
        "What would you like to do on Network?",
      ),
    ).toBeInTheDocument();
    expect(chat().querySelectorAll(".sugg")).toHaveLength(0);
    expect(within(chat()).queryByText("Is the network up?")).not.toBeInTheDocument();
  });

  it("puts a suggestion in the message box and focuses it without sending anything", async () => {
    startBackend();
    const user = userEvent.setup();
    openConsole("/h/siaya/models");

    await user.click(
      await within(await screen.findByRole("complementary")).findByRole(
        "button",
        { name: "Test the key" },
      ),
    );

    expect(composer()).toHaveValue("Test the key");
    expect(composer()).toHaveFocus();
    expect(askModelMock).not.toHaveBeenCalled();
  });

  it("sends the typed message to the open hub's picked model with Enter, clears the box and shows the message with the model's answer", async () => {
    startBackend();
    const user = userEvent.setup();
    openConsole("/h/siaya/models");
    await modelsOfLab();
    await chatReady();

    await typeMessage(user, "  hello there  {Enter}");

    const answer = await within(chat()).findByText(answerOf);
    expect(answer.closest(".msg")).toHaveClass("bot");
    expect(
      answer.closest(".msg")?.querySelector(".bot-badge svg"),
    ).not.toBeNull();
    expect(within(chat()).getByText("hello there").closest(".msg")).toHaveClass(
      "user",
    );
    expect(askModelMock).toHaveBeenCalledTimes(1);
    expect(askModelMock).toHaveBeenCalledWith(
      "siaya",
      "a-1",
      [{ role: "user", content: "hello there" }],
      "models", "", expect.any(AbortSignal)
    );
    expect(composer()).toHaveValue("");
    expect(
      within(chat()).queryByText(/What would you like to do/),
    ).not.toBeInTheDocument();
    expect(chat().querySelector(".chat-chips")).toBeNull();
    expect(within(chat()).queryByRole("alert")).not.toBeInTheDocument();
  });

  it("sends the typed message with the round Send button", async () => {
    startBackend();
    const user = userEvent.setup();
    openConsole("/h/siaya/models");

    await typeMessage(user, "via the button");
    await user.click(within(chat()).getByRole("button", { name: "Send" }));

    expect(await within(chat()).findByText(answerOf)).toBeInTheDocument();
    expect(within(chat()).getByText("via the button")).toBeInTheDocument();
    expect(askModelMock).toHaveBeenCalledTimes(1);
  });

  it("puts the message in the thread at once and turns the Send arrow into a Stop square until the answer is in", async () => {
    startBackend();
    const waiting = deferred();
    askModelMock.mockReturnValue(waiting.promise);
    const user = userEvent.setup();
    openConsole("/h/siaya/models");

    await typeMessage(user, "hello there{Enter}");

    const bubble = await within(chat()).findByText("hello there");
    expect(bubble.closest(".msg")).toHaveClass("user");
    expect(composer()).toHaveValue("");
    expect(within(chat()).queryByRole("button", { name: "Send" })).toBeNull();
    const stop = within(chat()).getByRole("button", { name: "Stop" });
    expect(stop).toBeEnabled();
    expect(stop.querySelector("svg")).not.toBeNull();
    expect(
      within(chat()).queryByText(/What would you like to do/),
    ).not.toBeInTheDocument();

    await act(async () => waiting.resolve({ text: "The answer.", calls: [] }));

    expect(await within(chat()).findByText("The answer.")).toBeInTheDocument();
    expect(within(chat()).getAllByText("hello there")).toHaveLength(1);
    const after = within(chat()).getByRole("button", { name: "Send" });
    expect(after).toBeEnabled();
    expect(within(chat()).queryByRole("button", { name: "Stop" })).toBeNull();
  });

  it("sends nothing more while an answer is awaited", async () => {
    startBackend();
    const waiting = deferred();
    askModelMock.mockReturnValue(waiting.promise);
    const user = userEvent.setup();
    openConsole("/h/siaya/models");

    await typeMessage(user, "first{Enter}");
    await within(chat()).findByText("first");
    await user.type(composer(), "second{Enter}");

    expect(askModelMock).toHaveBeenCalledTimes(1);
    expect(composer()).toHaveValue("second");
    await act(async () => waiting.resolve({ text: "The answer.", calls: [] }));
  });

  it("carries the whole conversation to the model with the next message", async () => {
    startBackend();
    askModelMock
      .mockResolvedValueOnce({ text: "First answer.", calls: [] })
      .mockResolvedValueOnce({ text: "Second answer.", calls: [] });
    const user = userEvent.setup();
    openConsole("/h/siaya/models");
    await chatReady();

    await typeMessage(user, "one{Enter}");
    await within(chat()).findByText("First answer.");
    await user.type(composer(), "two{Enter}");

    expect(
      await within(chat()).findByText("Second answer."),
    ).toBeInTheDocument();
    expect(askModelMock).toHaveBeenLastCalledWith(
      "siaya",
      "a-1",
      [
        { role: "user", content: "one" },
        { role: "assistant", content: "First answer." },
        { role: "user", content: "two" },
      ],
      "models", "", expect.any(AbortSignal)
    );
    expect(
      Array.from(chat().querySelectorAll(".msg")).map((m) => m.textContent),
    ).toEqual(
      ["one", "First answer.", "two", "Second answer."].map((x) =>
        expect.stringContaining(x),
      ),
    );
  });

  it("starts the conversation again in another hub", async () => {
    startBackend();
    const user = userEvent.setup();
    openConsole("/h/siaya/models");
    await chatReady();
    await typeMessage(user, "for siaya{Enter}");
    await within(chat()).findByText(answerOf);

    const drop = within(
      await openSwitcher(user, /Siaya Community Computer Lab/),
    );
    await user.click(drop.getByRole("link", { name: /Kisumu Farmers' Group/ }));

    expect(
      await screen.findByRole("heading", {
        name: "Models page of Kisumu Farmers' Group",
      }),
    ).toBeInTheDocument();
    expect(within(chat()).queryByText("for siaya")).not.toBeInTheDocument();
    expect(
      within(chat()).getByText("What would you like to do on Models?"),
    ).toBeInTheDocument();
    await chatReady();
    await user.type(composer(), "for kisumu{Enter}");
    await waitFor(() => expect(askModelMock).toHaveBeenCalledTimes(2));
    expect(askModelMock).toHaveBeenLastCalledWith(
      "kisumu",
      "a-1",
      [{ role: "user", content: "for kisumu" }],
      "models", "", expect.any(AbortSignal)
    );
  });

  it("hands the model no account when the hub has no model the chat can use", async () => {
    startBackend({ noModel: true });
    const user = userEvent.setup();
    openConsole("/h/siaya/models");
    await modelsOfLab();

    await typeMessage(user, "hello{Enter}");

    await waitFor(() =>
      expect(askModelMock).toHaveBeenCalledWith(
        "siaya",
        "",
        [{ role: "user", content: "hello" }],
        "models", "", expect.any(AbortSignal)
      ),
    );
  });

  it("starts a new line with Shift+Enter and sends nothing", async () => {
    startBackend();
    const user = userEvent.setup();
    openConsole("/h/siaya/models");

    await typeMessage(user, "one{Shift>}{Enter}{/Shift}two");

    expect(composer()).toHaveValue("one\ntwo");
    expect(askModelMock).not.toHaveBeenCalled();
  });

  it("sends nothing when the message box holds only spaces", async () => {
    startBackend();
    const user = userEvent.setup();
    openConsole("/h/siaya/models");

    await typeMessage(user, "   {Enter}");

    expect(askModelMock).not.toHaveBeenCalled();
  });

  it("takes the message back into the box and says why when the model could not answer", async () => {
    startBackend();
    askModelMock.mockRejectedValue(
      new McpError("ai_chat_account: no key is set for this account"),
    );
    const user = userEvent.setup();
    openConsole("/h/siaya/models");

    await typeMessage(user, "hello{Enter}");

    const alert = await within(chat()).findByRole("alert");
    expect(alert).toHaveTextContent(
      "The change could not be sent. ai_chat_account: no key is set for this account",
    );
    expect(alert.querySelector(".msg-card")).toHaveClass("bad");
    expect(composer()).toHaveValue("hello");
    expect(chat().querySelector(".msg.user")).toBeNull();
    expect(within(chat()).getByRole("button", { name: "Send" })).toBeEnabled();
    expect(
      within(chat()).getByText("What would you like to do on Models?"),
    ).toBeInTheDocument();
  });

  it("keeps what was already said and drops only the message that failed", async () => {
    startBackend();
    askModelMock
      .mockResolvedValueOnce({ text: "First answer.", calls: [] })
      .mockRejectedValueOnce(new Error("the model could not be reached"));
    const user = userEvent.setup();
    openConsole("/h/siaya/models");

    await typeMessage(user, "one{Enter}");
    await within(chat()).findByText("First answer.");
    await user.type(composer(), "two{Enter}");

    expect(await within(chat()).findByRole("alert")).toHaveTextContent(
      "The change could not be sent. the model could not be reached",
    );
    expect(composer()).toHaveValue("two");
    expect(within(chat()).getByText("one")).toBeInTheDocument();
    expect(within(chat()).getByText("First answer.")).toBeInTheDocument();
    expect(
      Array.from(chat().querySelectorAll(".msg.user")).map(
        (m) => m.textContent,
      ),
    ).toEqual(["one"]);
  });

  it("does not overwrite what was typed meanwhile when the message comes back", async () => {
    startBackend();
    const waiting = deferred();
    askModelMock.mockReturnValue(waiting.promise);
    const user = userEvent.setup();
    openConsole("/h/siaya/models");

    await typeMessage(user, "first{Enter}");
    await within(chat()).findByText("first");
    await user.type(composer(), "typed meanwhile");
    await act(async () => waiting.reject(new Error("down")));

    expect(await within(chat()).findByRole("alert")).toHaveTextContent(
      "The change could not be sent. down",
    );
    expect(composer()).toHaveValue("typed meanwhile");
  });

  it("says only that the message could not be sent when the failure carries no reason", async () => {
    startBackend();
    askModelMock.mockRejectedValue("refused");
    const user = userEvent.setup();
    openConsole("/h/siaya/models");

    await typeMessage(user, "hello{Enter}");

    expect((await within(chat()).findByRole("alert")).textContent).toBe(
      "The change could not be sent.",
    );
  });

  it("clears the reason when the next message is sent", async () => {
    startBackend();
    askModelMock
      .mockRejectedValueOnce(new Error("down"))
      .mockResolvedValueOnce({ text: "Back again.", calls: [] });
    const user = userEvent.setup();
    openConsole("/h/siaya/models");

    await typeMessage(user, "hello{Enter}");
    await within(chat()).findByRole("alert");
    await user.type(composer(), "{Enter}");

    expect(await within(chat()).findByText("Back again.")).toBeInTheDocument();
    expect(within(chat()).queryByRole("alert")).not.toBeInTheDocument();
  });

  it("collapses to the designed rail with the chat mark and the open button, and opens again", async () => {
    startBackend();
    const user = userEvent.setup();
    openConsole("/h/siaya/models");

    const column = await screen.findByRole("complementary", { name: "Chat" });
    expect(collapseButton()).toHaveAttribute("aria-expanded", "true");
    expect(column).not.toHaveClass("rail");

    await user.click(collapseButton());

    expect(chat()).toBe(column);
    expect(column).toHaveClass("rail");
    expect(column).toHaveAccessibleName("Chat, collapsed");
    expect(column.querySelector(".rail-ico svg")).not.toBeNull();
    expect(column.querySelector(".rail-dot")).toBeNull();
    expect(openButton()).toHaveAttribute("aria-expanded", "false");
    expect(within(column).queryByRole("textbox")).not.toBeInTheDocument();
    expect(
      within(column).queryByRole("heading", { name: "Chat" }),
    ).not.toBeInTheDocument();

    await user.click(openButton());
    expect(column).not.toHaveClass("rail");
    expect(composer()).toBeInTheDocument();
  });

  it("keeps the typed message while the chat is collapsed", async () => {
    startBackend();
    const user = userEvent.setup();
    openConsole("/h/siaya/models");

    await typeMessage(user, "keep me");
    await user.click(collapseButton());
    await user.click(openButton());

    expect(composer()).toHaveValue("keep me");
  });

  it("keeps the conversation while the chat is collapsed", async () => {
    startBackend();
    const user = userEvent.setup();
    openConsole("/h/siaya/models");
    await typeMessage(user, "hello{Enter}");
    await within(chat()).findByText(answerOf);

    await user.click(collapseButton());
    await user.click(openButton());

    expect(within(chat()).getByText("hello")).toBeInTheDocument();
    expect(within(chat()).getByText(answerOf)).toBeInTheDocument();
  });

  it("shows a dot on the rail when an answer arrives while the chat is collapsed and clears it when the chat is opened", async () => {
    startBackend();
    const waiting = deferred();
    askModelMock.mockReturnValue(waiting.promise);
    const user = userEvent.setup();
    openConsole("/h/siaya/models");
    await typeMessage(user, "hello{Enter}");
    await within(chat()).findByText("hello");
    await user.click(collapseButton());
    expect(chat().querySelector(".rail-dot")).toBeNull();

    await act(async () => waiting.resolve({ text: "The answer.", calls: [] }));

    await waitFor(() =>
      expect(chat().querySelector(".rail-dot")).not.toBeNull(),
    );
    expect(
      within(chat()).getByRole("img", { name: "New reply" }),
    ).toBeInTheDocument();

    await user.click(openButton());
    await user.click(collapseButton());
    expect(chat().querySelector(".rail-dot")).toBeNull();
  });

  it("shows no dot on a rail that starts collapsed", async () => {
    window.innerWidth = 800;
    startBackend();
    openConsole("/h/siaya/models");

    await modelsOfLab();
    await act(async () => {});

    expect(chat()).toHaveClass("rail");
    expect(chat().querySelector(".rail-dot")).toBeNull();
  });

  it("starts as the rail when the window is narrow", async () => {
    window.innerWidth = 800;
    startBackend();
    openConsole("/h/siaya/models");

    await modelsOfLab();
    expect(chat()).toHaveClass("rail");
    expect(openButton()).toBeInTheDocument();
  });

  it("starts open when the window is wide", async () => {
    window.innerWidth = 1440;
    startBackend();
    openConsole("/h/siaya/models");

    await modelsOfLab();
    expect(chat()).not.toHaveClass("rail");
  });
});

describe("the theme of the frame", () => {
  it("is dark until another theme is chosen", async () => {
    startBackend();
    openConsole("/h/siaya/models");

    await modelsOfLab();
    expect(root()).toHaveAttribute("data-theme", "dark");
  });

  it("carries the theme stored in the browser", async () => {
    localStorage.setItem("theme", "midnight");
    startBackend();
    openConsole("/h/siaya/models");

    await modelsOfLab();
    expect(root()).toHaveAttribute("data-theme", "midnight");
    expect(document.documentElement.dataset.theme).toBe("midnight");
  });

  it("falls back to dark when the stored theme is not one of the five", async () => {
    localStorage.setItem("theme", "neon");
    startBackend();
    openConsole("/h/siaya/models");

    await modelsOfLab();
    expect(root()).toHaveAttribute("data-theme", "dark");
  });

  it("changes at once when a page chooses another theme", async () => {
    startBackend();
    openConsole("/h/siaya/models");
    await modelsOfLab();

    act(() => saveTheme("forest"));

    expect(root()).toHaveAttribute("data-theme", "forest");
    expect(localStorage.getItem("theme")).toBe("forest");
  });
});

describe("opening the console", () => {
  it("renders nothing while the session is restored, then shows the console once", async () => {
    const backend = startBackend();
    openConsole("/h/siaya/models", { signedIn: false });

    expect(document.querySelector(".strip")).toBeNull();
    expect(screen.queryByRole("main")).not.toBeInTheDocument();

    expect(
      await screen.findByRole("heading", {
        name: "Models page of Siaya Community Computer Lab",
      }),
    ).toBeInTheDocument();
    expect(backend.callsTo("/auth/session")).toHaveLength(1);
    expect(backend.callsTo("/instances")).toHaveLength(1);
    expect(labSwitcher()).toBeInTheDocument();
  });

  it("reads the kind of each hub from what wakala lists when the session is restored", async () => {
    startBackend();
    const user = userEvent.setup();
    openConsole("/h/kisumu/models", { signedIn: false });

    await screen.findByRole("heading", {
      name: "Models page of Kisumu Farmers' Group",
    });
    expect(
      within(menu()).getByRole("link", { name: "Objectives" }),
    ).toBeInTheDocument();
    const drop = within(await openSwitcher(user, /Kisumu Farmers' Group/));
    expect(
      drop.getByRole("link", { name: /Siaya Community Computer Lab/ }),
    ).toHaveTextContent("Lab");
    expect(
      drop.getByRole("link", { name: /Nairobi Boda Boda Riders/ }),
    ).toHaveTextContent("Riders");
  });

  it("restores the session only once even when React runs the effects twice", async () => {
    const backend = startBackend();
    openConsole("/h/siaya/models", { signedIn: false, strict: true });

    expect(
      await screen.findByRole("heading", {
        name: "Models page of Siaya Community Computer Lab",
      }),
    ).toBeInTheDocument();
    expect(backend.callsTo("/auth/session")).toHaveLength(1);
    expect(backend.callsTo("/instances")).toHaveLength(1);
  });

  it("does not restore the session when the manager is already signed in", async () => {
    const backend = startBackend();
    openConsole("/h/siaya/models");

    await modelsOfLab();
    expect(backend.callsTo("/auth/session")).toHaveLength(0);
    expect(backend.callsTo("/instances")).toHaveLength(0);
  });

  it("goes to the sign-in page when there is no session to restore", async () => {
    const backend = startBackend({ signedIn: false });
    openConsole("/h/siaya/models", { signedIn: false });

    expect(await screen.findByText("sign-in page")).toBeInTheDocument();
    expect(backend.callsTo("/auth/session")).toHaveLength(1);
    expect(backend.callsTo("/instances")).toHaveLength(0);
    expect(callToolMock).not.toHaveBeenCalled();
  });

  it("goes back to the front door when the hub in the address is not one of the manager's hubs", async () => {
    startBackend();
    openConsole("/h/nowhere/models");

    expect(await screen.findByText("front door")).toBeInTheDocument();
    expect(callToolMock).not.toHaveBeenCalled();
  });
});

describe("the chat's answers in the content area", () => {
  const toolsReply: Reply = {
    text: "The list is in the content area.",
    calls: [{ name: "show_my_tools", summary: "", state: "done", ms: 4 }],
    answer: {
      kind: "tools",
      prompt: "What tools do we have?",
      rows: [
        {
          name: "ai_list_accounts",
          summary: "Lists the accounts.",
          area: "ai",
        },
        {
          name: "agency_list_roles",
          summary: "Lists the roles.",
          area: "agency",
        },
      ],
    },
  };

  const askTools = async () => {
    startBackend();
    askModelMock.mockResolvedValue(toolsReply);
    const user = userEvent.setup();
    openConsole("/h/siaya/models");
    await modelsOfLab();
    await chatReady();
    await typeMessage(user, "What tools do we have?{Enter}");
    await within(chat()).findByText(toolsReply.text);
    return user;
  };

  const banner = () =>
    screen.getByRole("region", { name: "Answer from the chat" });

  it("lands a list of the tools under the Answer-to banner, one row each with the tool, what it does and its area", async () => {
    await askTools();

    expect(within(banner()).getByText("Answer to:")).toBeInTheDocument();
    expect(
      within(banner()).getByText("What tools do we have?"),
    ).toBeInTheDocument();
    const rows = within(banner()).getAllByRole("row");
    expect(
      within(rows[0])
        .getAllByRole("columnheader")
        .map((cell) => cell.textContent),
    ).toEqual(["Tool", "What it does", "Area"]);
    expect(
      Array.from(rows[1].querySelectorAll("td")).map(
        (cell) => cell.textContent,
      ),
    ).toEqual(["ai_list_accounts", "Lists the accounts.", "Models and agents"]);
    expect(
      Array.from(rows[2].querySelectorAll("td")).map(
        (cell) => cell.textContent,
      ),
    ).toEqual(["agency_list_roles", "Lists the roles.", "Agency"]);
  });

  it("keeps the thread to the tool calls, a compact reference card and the model's sentence", async () => {
    await askTools();

    expect(within(chat()).getByText("Called 1 tool")).toBeInTheDocument();
    expect(
      within(chat()).getByText("Shown in the content area"),
    ).toBeInTheDocument();
    expect(within(chat()).getByText("2 results")).toBeInTheDocument();
    expect(
      within(chat()).queryByText("Lists the accounts."),
    ).not.toBeInTheDocument();
  });

  it("shows no banner before an answer lands, and closes it with Clear", async () => {
    const user = await askTools();

    await user.click(within(banner()).getByRole("button", { name: "Clear" }));

    expect(
      screen.queryByRole("region", { name: "Answer from the chat" }),
    ).not.toBeInTheDocument();
  });

  it("keeps the conversation and the answer across a reload", async () => {
    await askTools();

    cleanup();
    openConsole("/h/siaya/models");
    await modelsOfLab();

    expect(
      await within(chat()).findByText(toolsReply.text),
    ).toBeInTheDocument();
    expect(
      within(chat()).getAllByText("What tools do we have?").length,
    ).toBeGreaterThan(0);
    expect(within(banner()).getByText("ai_list_accounts")).toBeInTheDocument();
  });

  it("keeps each hub's conversation apart", async () => {
    await askTools();

    cleanup();
    openConsole("/h/kisumu/models");
    await chatReady();

    expect(within(chat()).queryByText(toolsReply.text)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Answer from the chat" }),
    ).not.toBeInTheDocument();
  });
});
