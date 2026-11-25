import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { servedAsHub } from "../../registerHub.test-support";
import { routes } from "./index";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

type Args = Record<string, unknown>;

const people = [
  { id: "p1", display_name: "Lilla Hársfa" },
  { id: "p2", display_name: "Bence Karsai" },
];

const addresses = [{ id: "d1", street: "Hársfa utca", number: "7", area: "Zöldhalom", postcode: "9999" }];

const businesses = [{ id: "b1", answers: { "Trading name": "Hársfa Bakery", "Kind of business": "Bakery", Neighbourhood: "Zöldhalom" } }];

const traders = [{ id: "t1", answers: { "Name or alias": "Sipos Eggs", "What is sold": "Duck eggs", Neighbourhood: "Malomsor" } }];

let called: MockInstance<typeof mcp.callTool>;

const answers: Record<string, (args: Args) => unknown> = {
  actor_list_actors: () => ({ items: people }),
  actor_get_actor: (args) => people.find((person) => person.id === args.actor_id),
  actor_list_groups_for_actor: () => ({ items: [] }),
  actor_list_groups: () => ({ items: [] }),
  digitaltwin_address_list: () => ({ items: addresses }),
  digitaltwin_address_read: () => addresses[0],
  assetmanager_asset_list: () => ({ items: [] }),
  agency_list_live_record_rows: (args) => ({ items: args.record_code === "RC-1" ? businesses : args.record_code === "RC-2" ? traders : [] }),
};

const setWide = (wide: boolean) => {
  window.matchMedia = ((query: string) => ({ matches: wide, media: query, addEventListener: () => undefined, removeEventListener: () => undefined })) as unknown as typeof window.matchMedia;
};

beforeEach(() => {
  openAgency("town");
  called = servedAsHub(vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => {
    const answer = answers[name];
    if (!answer) throw new Error(`${name} is not a tool the combined search may use`);
    return answer((args ?? {}) as Args);
  }));
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  Reflect.deleteProperty(window, "matchMedia");
  vi.restoreAllMocks();
});

const openSearch = async () => {
  render(
    <MemoryRouter initialEntries={[{ pathname: "/a/town/menu/residents/search", state: { from: { path: "/a/town/menu/residents", title: "People" } } }]}>
      <Routes>{routes()}</Routes>
    </MemoryRouter>,
  );
  return screen.findByRole("searchbox", { name: "Search" });
};

const pane = () => document.querySelector(".wf-main") as HTMLElement;

describe("the search pane on a wide screen", () => {
  it("shows a resident that is among the results and no other, when the word narrows the list", async () => {
    setWide(true);
    const box = await openSearch();
    await waitFor(() => expect(called).toHaveBeenCalledWith("", "actor_get_actor", { actor_id: "p1" }));
    await userEvent.type(box, "Karsai");

    await waitFor(() => expect(called).toHaveBeenCalledWith("", "actor_get_actor", { actor_id: "p2" }));
    await waitFor(() => expect(within(pane()).queryByText("Lilla Hársfa")).toBeNull());
    expect(within(pane()).getAllByText("Bence Karsai").length).toBeGreaterThan(0);
  });

  it("shows nothing when no result is left", async () => {
    setWide(true);
    const box = await openSearch();
    await screen.findAllByText("Lilla Hársfa");
    await userEvent.type(box, "Wombat");

    await screen.findByText(/Nothing matches/);
    await waitFor(() => expect(document.querySelector(".wf-main .wf-content")).toBeNull());
  });

  it("opens the trader record when a trader is the only result, not the resident or the owner's page", async () => {
    setWide(true);
    const box = await openSearch();
    await screen.findAllByText("Lilla Hársfa");
    await userEvent.type(box, "Sipos");

    expect(await within(pane()).findByText("Duck eggs")).toBeInTheDocument();
    expect(within(pane()).queryByText("Lilla Hársfa")).toBeNull();
  });
});

describe("the search results on a phone", () => {
  it("opens a business record when its row is pressed", async () => {
    setWide(false);
    const box = await openSearch();
    await userEvent.type(box, "Bakery");

    await userEvent.click(await screen.findByRole("button", { name: /Hársfa Bakery/ }));

    expect(await screen.findByText("Kind of business")).toBeInTheDocument();
    expect(screen.getAllByText("Bakery").length).toBeGreaterThan(0);
  });

  it("opens an informal trader record when its row is pressed", async () => {
    setWide(false);
    const box = await openSearch();
    await userEvent.type(box, "Sipos");

    await userEvent.click(await screen.findByRole("button", { name: /Sipos Eggs/ }));

    expect(await screen.findByText("Duck eggs")).toBeInTheDocument();
  });

  it("opens an address when its row is pressed", async () => {
    setWide(false);
    const box = await openSearch();
    await userEvent.type(box, "utca");

    await userEvent.click(await screen.findByRole("button", { name: /Hársfa utca 7/ }));

    await waitFor(() => expect(called).toHaveBeenCalledWith("", "digitaltwin_address_read", { addressID: "d1" }));
    expect(await screen.findByText("Postcode")).toBeInTheDocument();
  });
});
