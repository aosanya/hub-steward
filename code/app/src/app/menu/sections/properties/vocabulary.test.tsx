import { vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { items, routes } from "./index";
import { AddressesPage } from "./AddressesPage";
import { LandUsePage } from "./LandUsePage";
import { OwnershipPage } from "./OwnershipPage";
import { PlacesPage } from "./PlacesPage";

const agencyWords = { Places: "Properties", Place: "Property", Addresses: "Street numbers", Areas: "Zones", "Land Use": "Zoning" };

const answerWith = (words: Record<string, string>, assets: unknown[]) => (_agency: string, name: string) => {
  if (name === "agency_get_agency") return Promise.resolve({ name: "Zoldhalom" });
  if (name === "agency_list_mounts")
    return Promise.resolve({ modules: [{ module: "assetmanager" }, { module: "digitaltwin", mounts: [{ name: "Properties", words }] }] });
  if (name === "assetmanager_asset_list") return Promise.resolve({ items: assets });
  if (name === "assetmanager_asset_read") return Promise.resolve({ item: { id: "a1", name: "Town hall", category: "Building" } });
  if (name === "assetmanager_location_list") return Promise.resolve({ items: [] });
  return Promise.reject(new Error(`${name}: unknown tool`));
};

const show = (page: JSX.Element) =>
  render(
    <MemoryRouter initialEntries={["/a/town/menu/properties/page"]}>
      <Routes>
        <Route path="/a/:agencyId/menu/properties/page" element={page} />
      </Routes>
    </MemoryRouter>,
  );

const showRouted = () =>
  render(
    <MemoryRouter initialEntries={[items[0].path()]}>
      <Routes>{routes()}</Routes>
    </MemoryRouter>,
  );

beforeEach(() => openAgency("town"));

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

describe("the properties screens with an agency that lists words", () => {
  beforeEach(() => {
    vi.spyOn(mcp, "callTool").mockImplementation(async (agency, name) => answerWith(agencyWords, [])(agency, name));
  });

  it("shows the agency's word for places in the title and the empty state", async () => {
    show(<PlacesPage />);

    expect(await screen.findByText("No properties yet.")).toBeInTheDocument();
    expect(screen.getAllByText("Properties").length).toBeGreaterThan(0);
    expect(screen.queryByText("Places")).toBeNull();
  });

  it("shows the agency's word for addresses", async () => {
    show(<AddressesPage />);

    expect(await screen.findByText("No street numbers yet.")).toBeInTheDocument();
    expect(screen.getAllByText("Street numbers").length).toBeGreaterThan(0);
  });

  it("shows the agency's words for land use and its areas", async () => {
    show(<LandUsePage />);

    expect(await screen.findByText("No zones yet.")).toBeInTheDocument();
    expect(screen.getAllByText("Zoning").length).toBeGreaterThan(0);
  });

  it("shows the agency's word for properties on the ownership screen", async () => {
    show(<OwnershipPage />);

    expect(await screen.findByText("No properties yet.")).toBeInTheDocument();
  });

  it("names the agency's word on the Back button and the title of the detail", async () => {
    const listed = [{ id: "a1", name: "Town hall", category: "Building" }];
    vi.mocked(mcp.callTool).mockImplementation(async (agency, name) => answerWith(agencyWords, listed)(agency, name));
    showRouted();
    await userEvent.click(await screen.findByRole("button", { name: /Town hall/ }));

    expect(await screen.findByRole("button", { name: /Properties/ })).toBeInTheDocument();
    expect(screen.getAllByText("Property").length).toBeGreaterThan(0);
  });
});

describe("the properties screens with an agency that lists no words", () => {
  beforeEach(() => {
    vi.spyOn(mcp, "callTool").mockImplementation(async (agency, name) => answerWith({}, [])(agency, name));
  });

  it("shows the generic text", async () => {
    show(<PlacesPage />);

    expect(await screen.findByText("No places yet.")).toBeInTheDocument();
    expect(screen.getAllByText("Places").length).toBeGreaterThan(0);
  });

  it("shows the generic text on the land use screen", async () => {
    show(<LandUsePage />);

    expect(await screen.findByText("No areas yet.")).toBeInTheDocument();
    expect(screen.getAllByText("Land Use").length).toBeGreaterThan(0);
  });
});
