import { vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { items, routes } from "./index";

const section = { path: "/a/town/menu/settings", title: "Settings" };

let agencyName = "Riverside Office";
let landed = "";

const people = [
  { id: "p1", display_name: "Asha Otieno" },
  { id: "p2", display_name: "Bela Nagy" },
];

const standings: Record<string, unknown> = {
  p1: { actor_id: "p1", display_name: "Asha Otieno", seats: [{ id: "s1", role_name: "Clerk" }, { id: "s2", role_name: "Treasurer" }] },
  p2: { actor_id: "p2", display_name: "Bela Nagy", seats: [] },
};

const groups = [
  { id: "g1", name: "North Ward" },
  { id: "g2", name: "South Ward" },
];

const populations: Record<string, unknown> = { g1: { group_id: "g1", population: 1200 }, g2: { group_id: "g2", population: 845 } };

const accounts = [
  { id: "a1", name: "Writing helper", provider: "Anthropic", key_set: true },
  { id: "a2", name: "Translation helper", provider: "DeepL", key_set: false },
];

const reply = (name: string, args: Record<string, unknown>): unknown => {
  switch (name) {
    case "agency_get_agency":
      return { name: agencyName };
    case "instance_get_languages":
      return { studio_default: "en", content: ["en", "sw"], content_default: "en" };
    case "instance_rename":
      agencyName = (args as { name: string }).name;
      return { instance_id: "town", name: agencyName };
    case "actor_list_actors":
      return { items: people };
    case "actor_get_actor_standing":
      return standings[(args as { actor_id: string }).actor_id];
    case "actor_list_groups":
      return { items: groups };
    case "actor_get_group_population":
      return populations[(args as { group_id: string }).group_id];
    case "ai_list_accounts":
      return { items: accounts };
    default:
      throw new Error(`unexpected tool ${name}`);
  }
};

beforeEach(() => {
  agencyName = "Riverside Office";
  landed = "";
  openAgency("town");
  vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => reply(name, (args ?? {}) as Record<string, unknown>));
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

const itemFor = (title: string) => items.find((item) => item.title === title)!;

function Where() {
  landed = useLocation().pathname;
  return null;
}

const openAt = (title: string, state: unknown = { from: section }) =>
  render(
    <MemoryRouter initialEntries={[{ pathname: itemFor(title).path!(), state }]}>
      <Routes>
        {routes()}
        <Route path="*" element={null} />
      </Routes>
      <Where />
    </MemoryRouter>,
  );

const called = (name: string) => vi.mocked(mcp.callTool).mock.calls.filter((call) => call[1] === name);

describe("the Settings section's items", () => {
  it("lists the four screens built here, each one openable", () => {
    expect(items.map((item) => item.title)).toEqual(["Agency Profile", "Users & Roles", "Boundaries & Areas", "Integrations"]);
    for (const item of items) expect(item.path).toBeTypeOf("function");
  });

  it("gives each screen its own path under the Settings section of the open agency", () => {
    const paths = items.map((item) => item.path!());
    for (const path of paths) expect(path.startsWith("/a/town/menu/settings/")).toBe(true);
    expect(new Set(paths).size).toBe(4);
  });
});

describe("the Agency Profile screen", () => {
  it("shows the agency name and its languages", async () => {
    openAt("Agency Profile");

    expect(await screen.findByText("Riverside Office")).toBeInTheDocument();
    expect(await screen.findByText("en, sw")).toBeInTheDocument();
    expect(called("agency_get_agency").length).toBeGreaterThan(0);
    expect(called("instance_get_languages").length).toBeGreaterThan(0);
  });

  it("renames the agency through instance_rename and then shows the new name", async () => {
    openAt("Agency Profile");
    await screen.findByText("Riverside Office");

    await userEvent.click(screen.getByRole("button", { name: "Rename" }));
    const field = screen.getByRole("textbox", { name: /name/i });
    await userEvent.clear(field);
    await userEvent.type(field, "Lakeside Office");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Lakeside Office")).toBeInTheDocument();
    expect(called("instance_rename")).toHaveLength(1);
    expect(called("instance_rename")[0][2]).toEqual(expect.objectContaining({ name: "Lakeside Office" }));
    expect(screen.queryByText("Riverside Office")).toBeNull();
  });
});

describe("the Users & Roles screen", () => {
  it("lists each person from actor_list_actors with the roles they hold", async () => {
    openAt("Users & Roles");

    const asha = await screen.findByRole("button", { name: /Asha Otieno/ });
    expect(within(asha).getByText(/Clerk/)).toBeInTheDocument();
    expect(within(asha).getByText(/Treasurer/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Bela Nagy/ })).toBeInTheDocument();
    expect(called("actor_get_actor_standing").map((call) => call[2])).toEqual(expect.arrayContaining([expect.objectContaining({ actor_id: "p1" }), expect.objectContaining({ actor_id: "p2" })]));
  });
});

describe("the Boundaries & Areas screen", () => {
  it("lists each group with its resident count", async () => {
    openAt("Boundaries & Areas");

    const north = await screen.findByRole("button", { name: /North Ward/ });
    expect(within(north).getByText(/1200/)).toBeInTheDocument();
    const south = screen.getByRole("button", { name: /South Ward/ });
    expect(within(south).getByText(/845/)).toBeInTheDocument();
    expect(called("actor_get_group_population").map((call) => call[2])).toEqual(expect.arrayContaining([expect.objectContaining({ group_id: "g1" }), expect.objectContaining({ group_id: "g2" })]));
  });
});

describe("the Integrations screen", () => {
  it("lists each service with whether it is connected", async () => {
    openAt("Integrations");

    const anthropic = (await screen.findByText("Anthropic")).closest("button, .row") as HTMLElement;
    expect(within(anthropic).getByText("Connected")).toBeInTheDocument();
    const deepl = screen.getByText("DeepL").closest("button, .row") as HTMLElement;
    expect(within(deepl).getByText("Not connected")).toBeInTheDocument();
  });
});

describe.each(["Agency Profile", "Users & Roles", "Boundaries & Areas", "Integrations"])("the %s screen's Back button", (title) => {
  it("is named after the section it was opened from and goes back to it", async () => {
    openAt(title);
    await screen.findByRole("button", { name: /‹ Settings/ });

    await userEvent.click(screen.getByRole("button", { name: /‹ Settings/ }));

    expect(landed).toBe(section.path);
  });

  it("offers no named Back button when it was not opened from a section", async () => {
    openAt(title, undefined);
    await screen.findByRole("main");

    expect(screen.queryByRole("button", { name: /Settings/ })).toBeNull();
  });
});
