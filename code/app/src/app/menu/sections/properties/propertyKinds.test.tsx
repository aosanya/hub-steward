import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { PlacesPage } from "./PlacesPage";
import { loadPlaces, propertyKinds } from "./records";

let called: MockInstance<typeof mcp.callTool>;

const assets = [
  { id: "a1", name: "Zoldhalom town hall", category: "Building", attributes_json: JSON.stringify({ parcel_number: "0120/1" }) },
  { id: "a2", name: "Orchard plot", category: "Parcel", attributes_json: JSON.stringify({ parcel_number: "0201/3" }) },
  { id: "a3", name: "Kossuth ter water point", category: "Equipment" },
  { id: "a4", name: "Street light Arpad utca 12", category: "Facility" },
  { id: "a5", name: "Fo utca road", category: "Route" },
];

beforeEach(() => {
  openAgency("town");
  called = vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name) => {
    if (name === "assetmanager_asset_list") return { items: assets };
    throw new Error(`${name}: unknown tool`);
  });
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

describe("the Properties list holds buildings and parcels of land", () => {
  it("names the two kinds a property can be", () => {
    expect(propertyKinds).toEqual(["Building", "Parcel"]);
  });

  it("returns the building and the parcel, each saying which it is, and no equipment", async () => {
    const places = await loadPlaces();

    expect(places.map((place) => place.name)).toEqual(["Zoldhalom town hall", "Orchard plot"]);
    expect(places.map((place) => place.category)).toEqual(["Building · 0120/1", "Parcel · 0201/3"]);
  });

  it("shows no water point, street light or road, and still reads the one asset list", async () => {
    render(
      <MemoryRouter>
        <PlacesPage />
      </MemoryRouter>,
    );

    await screen.findByText("Orchard plot");
    expect(screen.getByText("Zoldhalom town hall")).toBeTruthy();
    expect(screen.queryByText("Kossuth ter water point")).toBeNull();
    expect(screen.queryByText("Street light Arpad utca 12")).toBeNull();
    expect(screen.queryByText("Fo utca road")).toBeNull();
    expect(called.mock.calls.filter(([, name]) => name === "assetmanager_asset_list")).toHaveLength(1);
  });

  it("matches the kind without regard to case", async () => {
    called.mockImplementation(async () => ({ items: [{ id: "b1", name: "Library", category: "building" }, { id: "b2", name: "Meadow", category: "PARCEL" }] }));

    const places = await loadPlaces();

    expect(places.map((place) => place.name)).toEqual(["Library", "Meadow"]);
  });
});
