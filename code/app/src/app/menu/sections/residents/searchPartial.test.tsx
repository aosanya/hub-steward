import { vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { servedAsHub } from "../../registerHub.test-support";
import { loadFailedWords } from "../../MenuList";
import { routes } from "./index";

type Args = Record<string, unknown>;

const searchPath = "/a/town/menu/residents/search";

const people = [{ id: "p1", display_name: "Lilla Hársfa" }];

const traders = [{ id: "t1", answers: { "Name or alias": "Hársfa Flowers", "What is sold": "Flowers", Neighbourhood: "Zöldhalom" } }];

const businessesRecord = "RC-1";

const answers: Record<string, (args: Args) => unknown> = {
  actor_list_actors: () => ({ items: people }),
  digitaltwin_address_list: () => {
    throw new Error("digitaltwin is not mounted");
  },
  assetmanager_asset_list: () => ({ items: [] }),
  agency_list_live_record_rows: (args) => {
    if (args.record_code === businessesRecord) throw new Error("this role may not read businesses");
    return { items: traders };
  },
};

const failEverything = () => {
  throw new Error("the hub is down");
};

const serve = (answerFor: (name: string) => (args: Args) => unknown) =>
  servedAsHub(vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => answerFor(name)((args ?? {}) as Args)));

beforeEach(() => openAgency("town"));

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

const openSearch = () => {
  render(
    <MemoryRouter initialEntries={[{ pathname: searchPath, state: { from: { path: "/a/town/menu/residents", title: "People" } } }]}>
      <Routes>{routes()}</Routes>
    </MemoryRouter>,
  );
};

describe("the combined search when a kind cannot load", () => {
  it("still lists the resident and the informal trader that share a word when businesses and addresses fail", async () => {
    serve((name) => answers[name] ?? (() => ({ items: [] })));
    openSearch();
    const box = await screen.findByRole("searchbox", { name: "Search" });

    await userEvent.type(box, "Hársfa");

    await waitFor(() => expect(screen.getByText("Lilla Hársfa")).toBeInTheDocument());
    expect(screen.getByText("Hársfa Flowers")).toBeInTheDocument();
    expect(screen.queryByText(loadFailedWords)).toBeNull();
  });

  it("says the list could not be loaded when every kind fails", async () => {
    serve(() => failEverything);
    openSearch();

    expect(await screen.findByText(loadFailedWords)).toBeInTheDocument();
    expect(screen.queryByRole("searchbox", { name: "Search" })).toBeNull();
  });
});
