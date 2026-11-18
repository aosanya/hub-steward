import { vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes } from "react-router-dom";
import { forgetWidth, setWide } from "../../../../features/inbox/fakeWidth";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { routes } from "./index";
import { placePaths } from "./paths";

const mounted = { modules: [{ module: "digitaltwin" }, { module: "assetmanager" }, { module: "taskmanager" }] };

const library = { id: "a1", name: "Zoldhalom Library", category: "Building", location_id: "l1", attributes_json: JSON.stringify({ place_id: "n1", parcel_number: "0412/7" }) };
const tenure = { id: "t1", place_id: "n1", holder: "Bela Szabo", kind: "owner", since: "2019-03-01T00:00:00Z" };
const address = { id: "d1", street: "Kossuth utca", number: "7", area: "Old Quarter", postcode: "6724" };
const landUse = { id: "u1", zone: "Residential", use: "Housing", area: "Old Quarter" };
const tasks = [{ id: "w1", title: "Repaint the reading room", state: "open", due_at: "2026-11-20T00:00:00Z", linked_ref: "a1" }];

let permissions: string[];

const answer = async (name: string) => {
  if (name === "agency_list_mounts") return mounted;
  if (name === "agency_get_my_roles") return { permissions };
  if (name === "assetmanager_asset_list") return { items: [library] };
  if (name === "assetmanager_asset_read") return { item: library };
  if (name === "assetmanager_location_read") return { item: { id: "l1", name: "Kossuth utca 7" } };
  if (name === "digitaltwin_tenure_list") return { items: [tenure] };
  if (name === "digitaltwin_tenure_read") return { item: tenure };
  if (name === "digitaltwin_node_list") return { items: [{ id: "n1", name: "Zoldhalom Library", kind: "building" }] };
  if (name === "digitaltwin_address_list") return { items: [address] };
  if (name === "digitaltwin_address_read") return { item: address };
  if (name === "digitaltwin_land_use_list") return { items: [landUse] };
  if (name === "digitaltwin_land_use_read") return { item: landUse };
  if (name === "taskmanager_task_list") return { items: tasks };
  return { items: [] };
};

beforeEach(() => {
  openAgency("zoldhalom");
  permissions = ["asset.manage", "digitaltwin.manage"];
  setWide(true);
  vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name) => answer(name));
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  forgetWidth();
  vi.restoreAllMocks();
});

const open = async (path: string, row: RegExp) => {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>{routes()}</Routes>
    </MemoryRouter>,
  );
  await userEvent.click(await screen.findByRole("button", { name: row }));
  return document.querySelector(".wf-main .wf-content") as HTMLElement;
};

describe("a place is built like a resident", () => {
  it("titles the page with the place's name, draws no band and keeps the bottom bar", async () => {
    const pane = within(await open(placePaths.places.path(), /Zoldhalom Library/));
    expect(await pane.findByRole("heading", { level: 1, name: "Zoldhalom Library" })).toBeInTheDocument();
    expect(document.querySelector(".wf-head")).toBeNull();
    expect(screen.getByRole("navigation", { name: "Main" })).toBeInTheDocument();
  });

  it("holds Name, Type, Location and Parcel number as plain rows of one Place detail card with Edit in its footer", async () => {
    const pane = within(await open(placePaths.places.path(), /Zoldhalom Library/));
    const card = within(await pane.findByRole("region", { name: "Place detail" }));
    for (const label of ["Name", "Type", "Location", "Parcel number"]) expect(card.getByText(label)).toBeInTheDocument();
    expect(card.getByText("0412/7")).toBeInTheDocument();
    expect(card.getAllByRole("button", { name: "Edit" })).toHaveLength(1);
    expect(card.getByRole("button", { name: "Edit" }).closest("footer")).not.toBeNull();
  });

  it("shows no Edit to a caller without asset.manage", async () => {
    permissions = ["digitaltwin.view"];
    const pane = within(await open(placePaths.places.path(), /Zoldhalom Library/));
    const card = within(await pane.findByRole("region", { name: "Place detail" }));
    await waitFor(() => expect(card.queryByRole("button", { name: "Edit" })).toBeNull());
  });

  it("draws Holdings and Works as cards with no footer act", async () => {
    const pane = within(await open(placePaths.places.path(), /Zoldhalom Library/));
    const holdings = await pane.findByRole("region", { name: "Holdings" });
    const works = await pane.findByRole("region", { name: "Works" });
    expect(within(holdings).getByText("Bela Szabo")).toBeInTheDocument();
    expect(within(works).getByText("Repaint the reading room")).toBeInTheDocument();
    expect(holdings.querySelector("footer")).toBeNull();
    expect(works.querySelector("footer")).toBeNull();
  });

  it("builds the page of a place with no linked place id and reads no holdings for it", async () => {
    const unlinked = { ...library, attributes_json: JSON.stringify({ parcel_number: "0412/7" }) };
    vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name) => {
      if (name === "assetmanager_asset_list") return { items: [unlinked] };
      if (name === "assetmanager_asset_read") return { item: unlinked };
      return answer(name);
    });
    const pane = within(await open(placePaths.places.path(), /Zoldhalom Library/));
    expect(await pane.findByRole("heading", { level: 1, name: "Zoldhalom Library" })).toBeInTheDocument();
    const holdings = await pane.findByRole("region", { name: "Holdings" });
    expect(within(holdings).getByText("No holdings yet.")).toBeInTheDocument();
    expect(mcp.callTool).not.toHaveBeenCalledWith(expect.anything(), "digitaltwin_tenure_list", expect.anything());
  });

  it("opens one edit screen from Edit, holding the fields under a single Save", async () => {
    const pane = within(await open(placePaths.places.path(), /Zoldhalom Library/));
    await userEvent.click(await pane.findByRole("button", { name: "Edit" }));
    expect(await screen.findByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Parcel number")).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByRole("button", { name: "Save" })).toHaveLength(1));
  });
});

describe.each([
  { title: "an address", path: () => placePaths.addresses.path(), row: /Kossuth utca 7/, heading: "Kossuth utca 7", card: "Address detail", labels: ["Street", "Number", "Area", "Postcode"] },
  { title: "a land use", path: () => placePaths.landUse.path(), row: /Residential/, heading: "Residential", card: "Land Use detail", labels: ["Zone", "Use", "Area"] },
  { title: "a holding", path: () => placePaths.ownership.path(), row: /Bela Szabo/, heading: "Bela Szabo", card: "Holding detail", labels: ["Holder", "Property", "Kind", "Since"] },
])("$title is built like a resident", ({ path: pathOf, row, heading, card, labels }) => {
  it("titles the page with its name, draws no band and keeps the bottom bar", async () => {
    const pane = within(await open(pathOf(), row));
    expect(await pane.findByRole("heading", { level: 1, name: heading })).toBeInTheDocument();
    expect(document.querySelector(".wf-head")).toBeNull();
    expect(screen.getByRole("navigation", { name: "Main" })).toBeInTheDocument();
  });

  it("holds its facts as plain rows of one card with no footer, since nothing here is edited", async () => {
    const pane = within(await open(pathOf(), row));
    const region = await pane.findByRole("region", { name: card });
    for (const label of labels) expect(within(region).getByText(label)).toBeInTheDocument();
    expect(region.querySelector("footer")).toBeNull();
  });
});
