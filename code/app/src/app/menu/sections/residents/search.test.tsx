import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { items, routes } from "./index";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

type Args = Record<string, unknown>;

const searchPath = "/a/town/menu/residents/search";

const people = [
  { id: "p1", display_name: "Lilla Hársfa" },
  { id: "p2", display_name: "Bence Karsai" },
];

const addresses = [
  { id: "d1", street: "Hársfa utca", number: "7", area: "Zöldhalom", postcode: "9999" },
  { id: "d2", street: "Kökény utca", number: "3", area: "Zöldhalom", postcode: "9999" },
];

const places = [
  { id: "a1", name: "Hársfa Community Hall", category: "Building" },
  { id: "a2", name: "Malom Barn", category: "Barn" },
];

const businesses = [
  { id: "b1", answers: { "Trading name": "Hársfa Bakery", "Kind of business": "Bakery", Neighbourhood: "Zöldhalom" } },
  { id: "b2", answers: { "Trading name": "Kökény Grocer", "Kind of business": "Grocer", Neighbourhood: "Zöldhalom" } },
];

const traders = [
  { id: "t1", answers: { "Name or alias": "Hársfa Flowers", "What is sold": "Flowers", Neighbourhood: "Zöldhalom" } },
  { id: "t2", answers: { "Name or alias": "Sipos Eggs", "What is sold": "Eggs", Neighbourhood: "Zöldhalom" } },
];

const memberships = [{ actor_id: "p1", group_id: "g1", priority: "normal" }];

const groups = [{ id: "g1", name: "Zöldhalom Gardeners", node_type: "Association" }];

const everyRowOutsideTheHársfaWord = ["Bence Karsai", "Kökény utca", "Malom Barn", "Kökény Grocer", "Sipos Eggs"];

let called: MockInstance<typeof mcp.callTool>;

const answers: Record<string, (args: Args) => unknown> = {
  actor_list_actors: () => ({ items: people }),
  actor_get_actor: (args) => people.find((person) => person.id === args.actor_id),
  actor_list_groups_for_actor: () => ({ items: memberships }),
  actor_list_groups: () => ({ items: groups }),
  digitaltwin_address_list: () => ({ items: addresses }),
  assetmanager_asset_list: () => ({ items: places }),
  agency_list_live_record_rows: (args) => ({ items: args.record_code === "RC-1" ? businesses : args.record_code === "RC-2" ? traders : [] }),
};

beforeEach(() => {
  openAgency("town");
  called = vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => {
    const answer = answers[name];
    if (!answer) throw new Error(`${name} is not a tool the combined search may use`);
    return answer((args ?? {}) as Args);
  });
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

const openSearch = async () => {
  render(
    <MemoryRouter initialEntries={[{ pathname: searchPath, state: { from: { path: "/a/town/menu/residents", title: "People" } } }]}>
      <Routes>{routes()}</Routes>
    </MemoryRouter>,
  );
  return screen.findByRole("searchbox", { name: "Search" });
};

const headingNamed = (name: string) => screen.queryByRole("heading", { name });

describe("the Residents submenu", () => {
  it("has a Search row that opens the combined search screen", () => {
    const row = items.find((item) => item.title === "Search");

    expect(row).toBeDefined();
    expect(row?.path?.()).toBe(searchPath);
  });
});

describe("the combined search", () => {
  it("loads people, addresses, places, businesses and informal traders when the screen opens", async () => {
    await openSearch();

    const names = called.mock.calls.map(([, name]) => name);
    expect(names).toEqual(expect.arrayContaining(["actor_list_actors", "digitaltwin_address_list", "assetmanager_asset_list"]));
    expect(called).toHaveBeenCalledWith("", "agency_list_live_record_rows", { record_code: "RC-1" });
    expect(called).toHaveBeenCalledWith("", "agency_list_live_record_rows", { record_code: "RC-2" });
  });

  it("lists a resident, an address, a place, a business and an informal trader that share one word, each under its own heading", async () => {
    const box = await openSearch();

    await userEvent.type(box, "Hársfa");

    await waitFor(() => expect(headingNamed("People")).toBeInTheDocument());
    expect(headingNamed("Properties")).toBeInTheDocument();
    expect(headingNamed("Businesses")).toBeInTheDocument();
    expect(headingNamed("Informal traders")).toBeInTheDocument();
    expect(screen.getByText("Lilla Hársfa")).toBeInTheDocument();
    expect(screen.getByText("Hársfa utca 7")).toBeInTheDocument();
    expect(screen.getByText("Hársfa Community Hall")).toBeInTheDocument();
    expect(screen.getByText("Hársfa Bakery")).toBeInTheDocument();
    expect(screen.getByText("Hársfa Flowers")).toBeInTheDocument();
    everyRowOutsideTheHársfaWord.forEach((name) => expect(screen.queryByText(name)).toBeNull());
  });

  it("shows only the headings whose group has a match when the word belongs to one resident alone", async () => {
    const box = await openSearch();

    await userEvent.type(box, "Karsai");

    expect(await screen.findByText("Bence Karsai")).toBeInTheDocument();
    expect(headingNamed("People")).toBeInTheDocument();
    expect(headingNamed("Properties")).toBeNull();
    expect(headingNamed("Businesses")).toBeNull();
    expect(headingNamed("Informal traders")).toBeNull();
    expect(screen.queryByText("Lilla Hársfa")).toBeNull();
  });

  it("says nothing matches in a card with a Clear search button inside it, and pressing it empties the box and brings the rows back", async () => {
    const box = await openSearch();
    await userEvent.type(box, "Wombat");

    const words = await screen.findByText(/Nothing matches/);
    const card = words.closest(".card") as HTMLElement;
    expect(card).not.toBeNull();
    expect(screen.queryByText("Lilla Hársfa")).toBeNull();
    expect(screen.queryByText("Hársfa Bakery")).toBeNull();

    await userEvent.click(within(card).getByRole("button", { name: "Clear search" }));

    expect(screen.getByRole("searchbox", { name: "Search" })).toHaveValue("");
    expect(await screen.findByText("Lilla Hársfa")).toBeInTheDocument();
    expect(screen.getByText("Bence Karsai")).toBeInTheDocument();
    expect(screen.getByText("Hársfa Bakery")).toBeInTheDocument();
    expect(screen.queryByText(/Nothing matches/)).toBeNull();
  });

  it("opens the same person detail People opens when a resident is pressed", async () => {
    const box = await openSearch();
    await userEvent.type(box, "Hársfa");

    await userEvent.click(await screen.findByRole("button", { name: /Lilla Hársfa/ }));

    await waitFor(() => expect(called).toHaveBeenCalledWith("", "actor_get_actor", { actor_id: "p1" }));
    expect(await screen.findByText("Zöldhalom Gardeners")).toBeInTheDocument();
    expect(screen.getAllByText("Lilla Hársfa").length).toBeGreaterThan(0);
  });
});
