import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { loadFailedWords } from "../../MenuList";
import { items, notMountedWords, routes } from "./index";
import { AddressesPage } from "./AddressesPage";
import { LandUsePage } from "./LandUsePage";
import { OwnershipPage } from "./OwnershipPage";
import { PlacesPage } from "./PlacesPage";

const assetList = "assetmanager_asset_list";
const assetRead = "assetmanager_asset_read";
const locationList = "assetmanager_location_list";
const locationRead = "assetmanager_location_read";

const assets = [
  { id: "a1", name: "Town hall", category: "Building", location_id: "l2" },
  { id: "a2", name: "Market square", category: "Square", location_id: "l3" },
];

const locations = [
  { id: "l1", name: "Old Town", kind: "district", parent_location_id: "" },
  { id: "l2", name: "12 Main Street", kind: "address", parent_location_id: "l1" },
  { id: "l3", name: "4 Mill Lane", kind: "address", parent_location_id: "l1" },
];

const mounted = { modules: [{ module: "digitaltwin" }, { module: "assetmanager" }] };

const origin = { path: "/a/town/menu/properties", title: "Places & Addresses" };

let called: MockInstance<typeof mcp.callTool>;
let landed = "";

const Where = () => {
  landed = useLocation().pathname;
  return null;
};

const answer = (name: string, args: unknown) => {
  if (name === "agency_list_mounts") return Promise.resolve(mounted);
  if (name === assetList) return Promise.resolve({ items: assets });
  if (name === locationList) return Promise.resolve({ items: locations });
  if (name === assetRead) return Promise.resolve({ item: assets.find((asset) => asset.id === (args as { id: string }).id) });
  if (name === locationRead) return Promise.resolve({ item: locations.find((place) => place.id === (args as { id: string }).id) });
  return Promise.reject(new Error(`${name}: unknown tool`));
};

beforeEach(() => {
  openAgency("town");
  called = vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => answer(name, args));
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

const callsTo = (name: string) => called.mock.calls.filter(([, tool]) => tool === name);

const show = (page: JSX.Element, entry: string | { pathname: string; state: unknown } = "/a/town/menu/properties/page") =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/a/:agencyId/menu/properties/page" element={page} />
        <Route path="*" element={null} />
      </Routes>
      <Where />
    </MemoryRouter>,
  );

const showRouted = (title: string) => {
  const entry = items.find((item) => item.title === title)?.path?.() ?? "";
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>{routes()}</Routes>
      <Where />
    </MemoryRouter>,
  );
};

const rowOf = (title: string) => screen.getByText(title, { selector: ".ttl" }).closest(".row") as HTMLElement;

const metaOf = (row: HTMLElement) => Array.from(row.querySelectorAll(".meta")).map((line) => line.textContent);

describe("the Places and Addresses section items", () => {
  it("lists Places, Addresses, Ownership & Tenure and Land Use, each opening a screen", () => {
    expect(items.map((item) => item.title)).toEqual(["Places", "Addresses", "Ownership & Tenure", "Land Use"]);
    for (const item of items) expect(typeof item.path?.()).toBe("string");
  });
});

describe("Places", () => {
  it("lists each asset with its name and its type", async () => {
    show(<PlacesPage />);

    await screen.findByText("Town hall", { selector: ".ttl" });
    expect(metaOf(rowOf("Town hall"))).toEqual(["Building"]);
    expect(metaOf(rowOf("Market square"))).toEqual(["Square"]);
    expect(callsTo(assetList)).toHaveLength(1);
    expect(callsTo(locationList)).toHaveLength(0);
  });

  it("opens a place detail from a row, showing the asset's name and type and the location it sits in", async () => {
    showRouted("Places");
    await userEvent.click(await screen.findByRole("button", { name: /Town hall/ }));

    expect(await screen.findByText("12 Main Street")).toBeInTheDocument();
    expect(screen.getAllByText("Town hall").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Building").length).toBeGreaterThan(0);
    expect(called).toHaveBeenCalledWith("", assetRead, { id: "a1" });
    expect(called).toHaveBeenCalledWith("", locationRead, { id: "l2" });
  });

  it("names Places on the Back button of the place detail and returns to the list", async () => {
    showRouted("Places");
    await userEvent.click(await screen.findByRole("button", { name: /Town hall/ }));
    await screen.findByText("12 Main Street");

    await userEvent.click(screen.getByRole("button", { name: /Places/ }));

    expect(await screen.findByRole("button", { name: /Market square/ })).toBeInTheDocument();
    expect(screen.queryByText("12 Main Street")).toBeNull();
  });

  it("names the screen the person came from on the Back button of the list", async () => {
    show(<PlacesPage />, { pathname: "/a/town/menu/properties/page", state: { from: origin } });
    await screen.findByText("Town hall", { selector: ".ttl" });

    await userEvent.click(screen.getByRole("button", { name: /Places & Addresses/ }));

    await waitFor(() => expect(landed).toBe(origin.path));
  });
});

describe("Addresses", () => {
  it("lists each location with its street line and the place it belongs to", async () => {
    show(<AddressesPage />);

    await screen.findByText("12 Main Street", { selector: ".ttl" });
    expect(metaOf(rowOf("12 Main Street"))).toEqual(["Old Town"]);
    expect(metaOf(rowOf("4 Mill Lane"))).toEqual(["Old Town"]);
    expect(callsTo(locationList)).toHaveLength(1);
    expect(callsTo(assetList)).toHaveLength(0);
  });

  it("names the screen the person came from on the Back button", async () => {
    show(<AddressesPage />, { pathname: "/a/town/menu/properties/page", state: { from: origin } });
    await screen.findByText("12 Main Street", { selector: ".ttl" });

    await userEvent.click(screen.getByRole("button", { name: /Places & Addresses/ }));

    await waitFor(() => expect(landed).toBe(origin.path));
  });
});

describe("Ownership & Tenure", () => {
  it("lists each asset by name only", async () => {
    show(<OwnershipPage />);

    await screen.findByText("Town hall", { selector: ".ttl" });
    expect(rowOf("Town hall")).toHaveTextContent(/^Town hall$/);
    expect(metaOf(rowOf("Town hall"))).toEqual([]);
    expect(metaOf(rowOf("Market square"))).toEqual([]);
    expect(screen.queryByText("Building")).toBeNull();
    expect(callsTo(assetList)).toHaveLength(1);
  });
});

describe("Land Use", () => {
  it("lists each location by area name only", async () => {
    show(<LandUsePage />);

    await screen.findByText("Old Town", { selector: ".ttl" });
    expect(rowOf("Old Town")).toHaveTextContent(/^Old Town$/);
    expect(metaOf(rowOf("Old Town"))).toEqual([]);
    expect(metaOf(rowOf("4 Mill Lane"))).toEqual([]);
    expect(callsTo(locationList)).toHaveLength(1);
    expect(callsTo(assetList)).toHaveLength(0);
  });
});

describe("a hub that does not mount the asset module", () => {
  beforeEach(() => {
    called.mockImplementation(async (_agency, name) => {
      if (name === "agency_list_mounts") return { modules: [{ module: "digitaltwin" }] };
      throw new Error(`${name}: unknown tool`);
    });
  });

  it.each([
    ["Places", <PlacesPage />],
    ["Addresses", <AddressesPage />],
    ["Ownership & Tenure", <OwnershipPage />],
    ["Land Use", <LandUsePage />],
  ])("says plainly why %s lists nothing", async (_title, page) => {
    show(page);

    expect(await screen.findByText(notMountedWords)).toBeInTheDocument();
    expect(screen.queryByText(loadFailedWords)).toBeNull();
    expect(document.querySelectorAll(".row")).toHaveLength(0);
    expect(within(document.body).queryByRole("searchbox")).toBeNull();
  });
});
