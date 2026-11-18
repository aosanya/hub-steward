import { vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { forgetWidth, setWide } from "../../../../features/inbox/fakeWidth";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { placePaths } from "../properties/paths";
import { items, routes } from "./index";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

const personName = "Bela Szabo";
const personId = "p1";

const townHall = { id: "a1", name: "Zoldhalom Town Hall", category: "Building", attributes_json: JSON.stringify({ place_id: "n1" }) };
const unlinked = { id: "a2", name: "Zoldhalom Market Hall", category: "Building", attributes_json: JSON.stringify({}) };

const holdings = [
  { id: "t1", place_id: "n1", kind: "owner", since: "2019-03-01T00:00:00Z" },
  { id: "t2", place_id: "n2", kind: "tenant", since: "2021-05-04T00:00:00Z" },
];

const nodes = [
  { id: "n1", name: "Zoldhalom Town Hall" },
  { id: "n2", name: "Zoldhalom Orchard Plot" },
];

let landed: { pathname: string; state: unknown };
let assetsFailing: boolean;

const Where = () => {
  const here = useLocation();
  landed = { pathname: here.pathname, state: here.state };
  return null;
};

const answer = async (name: string) => {
  if (name === "agency_list_mounts") return { modules: [{ module: "actor" }, { module: "forms" }, { module: "digitaltwin" }, { module: "assetmanager" }] };
  if (name === "agency_get_my_roles") return { permissions: ["member.view"] };
  if (name === "actor_list_actors") return { items: [{ id: personId, display_name: personName, status: "active" }] };
  if (name === "actor_get_actor") return { id: personId, display_name: personName, status: "active" };
  if (name === "actor_list_groups_for_actor") return { items: [{ group_id: "g1" }] };
  if (name === "actor_list_groups") return { items: [{ id: "g1", name: "Zoldhalom Street Group" }] };
  if (name === "actor_list_attribute_properties") return { items: [] };
  if (name === "digitaltwin_tenure_list") return { items: holdings };
  if (name === "digitaltwin_node_list") return { items: nodes };
  if (name === "assetmanager_asset_list") {
    if (assetsFailing) throw new mcp.McpError("assetmanager_asset_list: the hub refused this");
    return { items: [townHall, unlinked] };
  }
  return { items: [] };
};

beforeEach(() => {
  openAgency("zoldhalom");
  assetsFailing = false;
  landed = { pathname: "", state: null };
  vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name) => answer(name));
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  forgetWidth();
  vi.restoreAllMocks();
});

const openPerson = async (wide: boolean) => {
  setWide(wide);
  const path = items.find((item) => item.title === "All People")?.path?.() ?? "";
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        {routes()}
        <Route path={placePaths.place.pattern} element={<p>Property page</p>} />
        <Route path={placePaths.holding.pattern} element={<p>Holding page</p>} />
      </Routes>
      <Where />
    </MemoryRouter>,
  );
  await userEvent.click(await screen.findByRole("button", { name: new RegExp(personName) }));
  await screen.findByText("Zoldhalom Street Group");
};

describe.each([
  { name: "the phone", wide: false },
  { name: "the computer", wide: true },
])("a Holdings row on a resident's page on $name", ({ wide }) => {
  it("opens the property page of the asset whose place is the holding's place, not a page keyed by the node id", async () => {
    await openPerson(wide);

    await userEvent.click(await screen.findByRole("button", { name: /Zoldhalom Town Hall/ }));

    expect(await screen.findByText("Property page")).toBeInTheDocument();
    expect(landed.pathname).toBe(placePaths.place.path({ placeId: "a1" }));
    expect(landed.pathname).not.toContain("n1");
  });

  it("opens the holding page when no asset has the holding's place", async () => {
    await openPerson(wide);

    await userEvent.click(await screen.findByRole("button", { name: /Zoldhalom Orchard Plot/ }));

    expect(await screen.findByText("Holding page")).toBeInTheDocument();
    expect(landed.pathname).toBe(placePaths.holding.path({ tenureId: "t2" }));
  });

  it("opens the holding page for every holding when the asset list is refused, and still lists the holdings", async () => {
    assetsFailing = true;
    await openPerson(wide);

    await userEvent.click(await screen.findByRole("button", { name: /Zoldhalom Town Hall/ }));

    expect(await screen.findByText("Holding page")).toBeInTheDocument();
    expect(landed.pathname).toBe(placePaths.holding.path({ tenureId: "t1" }));
    expect(screen.queryByText(/the hub refused this/)).toBeNull();
  });

  it("keeps Back on the resident's page after opening the property", async () => {
    await openPerson(wide);

    await userEvent.click(await screen.findByRole("button", { name: /Zoldhalom Town Hall/ }));

    await waitFor(() => expect(landed.pathname).toBe(placePaths.place.path({ placeId: "a1" })));
    expect((landed.state as { from: { title: string } }).from.title).toBe("Residents");
  });
});
