import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { MemoryRouter } from "react-router-dom";
import { App } from "../App";
import { I18nProvider } from "../i18n";
import { SessionProvider } from "../session";
import { setRuntimeConfig } from "../wakala/config";
import { callTool, resetMcp } from "../wakala/mcp";

vi.hoisted(() => {
  process.env.RTL_SKIP_AUTO_CLEANUP = "true";
});

vi.setConfig({ testTimeout: 30000 });

vi.mock("../wakala/mcp", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../wakala/mcp")>()),
  callTool: vi.fn(),
}));

type Rec = Record<string, unknown>;

const words = JSON.parse(readFileSync(resolve(__dirname, "../../public/i18n.json"), "utf8"));

const MUNICIPALITY = "mun";
const MAYOR = { id: "ro1", code: "R-1", name: "Mayor / council chair" };
const NEW_TEXT = "We keep your answers for one year.";

const inForce = { version: "v3", clauses: [{ key: "consent", text: "We keep your answers for three years." }] };

let versions: Rec[] = [];
let myRoles: Rec = {};
const calls: { tool: string; args: Rec }[] = [];

const fakeTools = async (_hub: string, tool: string, args: Rec = {}) => {
  calls.push({ tool, args });
  if (tool === "custody_list_consent_versions") return { items: versions };
  if (tool === "custody_get_in_force_consent") return inForce;
  if (tool === "custody_publish_consent_version") {
    versions = [
      { id: "c4", version: "v4", published_at: "2026-11-13T09:00:00Z", in_force: true },
      ...versions.map((version) => ({ ...version, in_force: false })),
    ];
    return { version: "v4" };
  }
  return { items: [] };
};

const stubWakala = () =>
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const path = new URL(String(input), "http://console.test").pathname;
      const found = path === "/instances/" + MUNICIPALITY + "/my-roles";
      const data =
        path === "/instances"
          ? [{ id: MUNICIPALITY, name: "Municipality", role: "resident", kind: "municipality" }]
          : found
            ? myRoles
            : {};
      const missing = path === "/config.json";
      return { ok: !missing, status: missing ? 404 : 200, headers: new Headers(), json: async () => data, text: async () => "" };
    }),
  );

const mountConsole = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <I18nProvider initial={words}>
        <SessionProvider>
          <App />
        </SessionProvider>
      </I18nProvider>
    </MemoryRouter>,
  );

const user = userEvent.setup();

const main = () => within(document.querySelector("main") as HTMLElement);
const menu = () => within(screen.getByRole("navigation", { name: "Menu" }));
const heading = (name: string) => screen.findByRole("heading", { level: 1, name });
const callsTo = (tool: string) => calls.filter((call) => call.tool === tool);

beforeEach(() => {
  resetMcp();
  setRuntimeConfig({ wakala: "", mcp: "/mcp" });
  calls.length = 0;
  versions = [{ id: "c3", version: "v3", published_at: "2026-09-01T09:00:00Z", in_force: true }];
  vi.mocked(callTool).mockImplementation(fakeTools as unknown as typeof callTool);
  stubWakala();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

afterAll(() => {
  delete process.env.RTL_SKIP_AUTO_CLEANUP;
});

describe("A Mayor publishes a new consent text version: the whole journey", () => {
  it("step 1 · signs in as a resident whose role holds consent.publish and lands on Consent text with the versions so far", async () => {
    myRoles = {
      instance_id: MUNICIPALITY,
      membership: "resident",
      roles: [MAYOR],
      permissions: ["consent.publish", "forms.read"],
    };
    mountConsole("/");

    expect(await heading("Consent text")).toBeInTheDocument();
    expect(menu().getByRole("link", { name: "Consent text" })).toHaveAttribute("aria-current", "page");
    expect(await main().findByText("Version 3")).toBeInTheDocument();
    expect(main().getByText("In force")).toBeInTheDocument();
    expect(main().getByRole("link", { name: "New version" })).toBeInTheDocument();
    expect(callsTo("custody_list_consent_versions")).toHaveLength(1);
    expect(callsTo("custody_publish_consent_version")).toHaveLength(0);
  });

  it("step 2 · presses New version, edits the text in force and presses Publish, and sees Published as version 4 on the list", async () => {
    myRoles = {
      instance_id: MUNICIPALITY,
      membership: "resident",
      roles: [MAYOR],
      permissions: ["consent.publish"],
    };
    mountConsole("/");
    await heading("Consent text");

    await user.click(await main().findByRole("link", { name: "New version" }));
    await heading("New version");
    const box = await screen.findByRole("textbox", { name: /Consent text/ });
    await waitFor(() => expect(box).toHaveValue(inForce.clauses[0].text));
    expect(callsTo("custody_get_in_force_consent")).toHaveLength(1);

    await user.clear(box);
    await user.type(box, NEW_TEXT);
    await user.click(screen.getByRole("button", { name: "Publish" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Published as version 4");
    await heading("Consent text");
    expect(await main().findByText("Version 4")).toBeInTheDocument();
    expect(main().getByText("Version 3")).toBeInTheDocument();
    expect(main().getByText("Replaced")).toBeInTheDocument();
    expect(callsTo("custody_publish_consent_version").map((call) => call.args)).toEqual([{ text: NEW_TEXT }]);
    expect(calls.map((call) => call.tool).filter((tool) => tool.startsWith("custody_"))).toEqual([
      "custody_list_consent_versions",
      "custody_get_in_force_consent",
      "custody_publish_consent_version",
      "custody_list_consent_versions",
    ]);
  });
});

describe("A member without the permission has no hub", () => {
  it("a resident whose roles lack consent.publish ends on Your hubs with You do not run a hub yet and no tool is called", async () => {
    myRoles = {
      instance_id: MUNICIPALITY,
      membership: "resident",
      roles: [{ id: "ro9", code: "R-9", name: "Resident" }],
      permissions: ["forms.read"],
    };
    mountConsole("/hubs");

    expect(await heading("Your hubs")).toBeInTheDocument();
    expect(await screen.findByText("You do not run a hub yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create a hub" })).toBeInTheDocument();
    expect(screen.queryByText("Municipality")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Consent text" })).toBeNull();
    expect(calls).toEqual([]);
  });
});
