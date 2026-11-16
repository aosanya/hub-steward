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

const addressList = "digitaltwin_address_list";
const tenureList = "digitaltwin_tenure_list";
const landUseList = "digitaltwin_land_use_list";

const addresses = [
  { id: "d1", street: "Main Street", number: "12", area: "Old Town", postcode: "6724", place_id: "n1" },
  { id: "d2", street: "Mill Lane", number: "4", area: "", postcode: "", place_id: "" },
];

const tenures = [
  { id: "t1", place_id: "n1", holder: "Anna Kovacs", kind: "owner", since: "2019-03-01T00:00:00Z" },
  { id: "t2", place_id: "n2", holder: "Town Library Trust", kind: "custodian", since: "" },
];

const landUses = [
  { id: "u1", place_id: "", area: "Old Town", zone: "Residential", use: "Housing" },
  { id: "u2", place_id: "n2", area: "", zone: "Civic", use: "" },
];

const mounted = { modules: [{ module: "digitaltwin" }, { module: "assetmanager" }] };

const origin = { path: "/a/town/menu/properties", title: "Places & Addresses" };

let called: MockInstance<typeof mcp.callTool>;
let landed = "";

const Where = () => {
  landed = useLocation().pathname;
  return null;
};

const byArgument = <T extends { id: string }>(rows: T[], args: unknown, argument: string) => {
  const given = Object.keys((args ?? {}) as object);
  if (given.length !== 1 || given[0] !== argument) throw new Error(`takes only ${argument}, got ${given.join(",") || "nothing"}`);
  return rows.find((row) => row.id === (args as Record<string, string>)[argument]);
};

const answer = (name: string, args: unknown) => {
  if (name === "agency_list_mounts") return Promise.resolve(mounted);
  if (name === addressList) return Promise.resolve({ items: addresses });
  if (name === tenureList) return Promise.resolve({ items: tenures });
  if (name === landUseList) return Promise.resolve({ items: landUses });
  if (name === assetList) return Promise.resolve({ items: assets });
  if (name === locationList) return Promise.resolve({ items: locations });
  if (name === assetRead) return Promise.resolve({ item: byArgument(assets, args, "assetID") });
  if (name === locationRead) return Promise.resolve({ item: byArgument(locations, args, "locationID") });
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
    expect(called).toHaveBeenCalledWith("", assetRead, { assetID: "a1" });
    expect(called).toHaveBeenCalledWith("", locationRead, { locationID: "l2" });
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
  it("lists each address with its street and number, and the postcode and area it lies in", async () => {
    show(<AddressesPage />);

    await screen.findByText("Main Street 12", { selector: ".ttl" });
    expect(metaOf(rowOf("Main Street 12"))).toEqual(["6724 Old Town"]);
    expect(metaOf(rowOf("Mill Lane 4"))).toEqual([]);
    expect(callsTo(addressList)).toHaveLength(1);
    expect(callsTo(locationList)).toHaveLength(0);
    expect(callsTo(assetList)).toHaveLength(0);
  });

  it("names the screen the person came from on the Back button", async () => {
    show(<AddressesPage />, { pathname: "/a/town/menu/properties/page", state: { from: origin } });
    await screen.findByText("Main Street 12", { selector: ".ttl" });

    await userEvent.click(screen.getByRole("button", { name: /Places & Addresses/ }));

    await waitFor(() => expect(landed).toBe(origin.path));
  });

  it("says there are none when the digitaltwin keeps no addresses", async () => {
    called.mockImplementation(async (_agency, name) => (name === addressList ? { items: [] } : answer(name, undefined)));
    show(<AddressesPage />);

    expect(await screen.findByText("No addresses yet.")).toBeInTheDocument();
  });
});

describe("Ownership & Tenure", () => {
  it("lists each holder with the kind of holding and since when", async () => {
    show(<OwnershipPage />);

    await screen.findByText("Anna Kovacs", { selector: ".ttl" });
    expect(metaOf(rowOf("Anna Kovacs"))).toEqual(["owner · since 2019-03-01"]);
    expect(metaOf(rowOf("Town Library Trust"))).toEqual(["custodian"]);
    expect(callsTo(tenureList)).toHaveLength(1);
    expect(callsTo(assetList)).toHaveLength(0);
  });
});

describe("Land Use", () => {
  it("lists each zone with its use and the area it covers", async () => {
    show(<LandUsePage />);

    await screen.findByText("Residential", { selector: ".ttl" });
    expect(metaOf(rowOf("Residential"))).toEqual(["Housing · Old Town"]);
    expect(metaOf(rowOf("Civic"))).toEqual([]);
    expect(callsTo(landUseList)).toHaveLength(1);
    expect(callsTo(locationList)).toHaveLength(0);
  });
});

describe("a hub that does not mount the asset module", () => {
  beforeEach(() => {
    called.mockImplementation(async (_agency, name) => {
      if (name === "agency_list_mounts") return { modules: [{ module: "digitaltwin" }] };
      throw new Error(`${name}: unknown tool`);
    });
  });

  it("says plainly why Places lists nothing", async () => {
    show(<PlacesPage />);

    expect(await screen.findByText(notMountedWords)).toBeInTheDocument();
    expect(screen.queryByText(loadFailedWords)).toBeNull();
    expect(document.querySelectorAll(".row")).toHaveLength(0);
    expect(within(document.body).queryByRole("searchbox")).toBeNull();
  });
});

describe("a hub that does not mount the digitaltwin module", () => {
  beforeEach(() => {
    called.mockImplementation(async (_agency, name) => {
      if (name === "agency_list_mounts") return { modules: [{ module: "assetmanager" }] };
      throw new Error(`${name}: unknown tool`);
    });
  });

  it.each([
    ["Addresses", <AddressesPage />],
    ["Ownership & Tenure", <OwnershipPage />],
    ["Land Use", <LandUsePage />],
  ])("says plainly why %s lists nothing", async (_title, page) => {
    show(page);

    expect(await screen.findByText(notMountedWords)).toBeInTheDocument();
    expect(screen.queryByText(loadFailedWords)).toBeNull();
    expect(document.querySelectorAll(".row")).toHaveLength(0);
    expect(within(document.body).queryByRole("searchbox")).toBeNull();
    expect(callsTo(addressList)).toHaveLength(0);
    expect(callsTo(tenureList)).toHaveLength(0);
    expect(callsTo(landUseList)).toHaveLength(0);
  });
});
