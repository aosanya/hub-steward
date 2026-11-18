import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { routes } from "./index";
import { PlacesPage } from "./PlacesPage";
import { placePaths } from "./paths";
import { parcelOf, withParcel } from "./records";

let called: MockInstance<typeof mcp.callTool>;
let permissions: string[];
let assets: Record<string, string>[];

const answer = async (name: string, args: unknown) => {
  const given = (args ?? {}) as Record<string, string>;
  if (name === "agency_get_my_roles") return { permissions };
  if (name === "assetmanager_asset_list") return { items: assets };
  if (name === "assetmanager_asset_read") return { item: assets.find((asset) => asset.id === given.assetID) };
  if (name === "assetmanager_location_read") return { item: { id: "l1", name: "Old Town" } };
  if (name === "assetmanager_asset_update") {
    assets = assets.map((asset) => (asset.id === given.assetID ? { ...asset, ...given } : asset));
    return {};
  }
  throw new Error(`${name}: unknown tool`);
};

beforeEach(() => {
  openAgency("town");
  permissions = ["asset.manage"];
  assets = [
    { id: "a1", name: "Corner plot", category: "Parcel", location_id: "l1", attributes_json: JSON.stringify({ parcel_number: "0123/4/A" }) },
    { id: "a2", name: "Market square", category: "Square", location_id: "l1" },
  ];
  called = vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => answer(name, args));
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

const openPlace = async (placeId: string, title: string) => {
  render(
    <MemoryRouter initialEntries={[placePaths.place.path({ placeId })]}>
      <Routes>{routes()}</Routes>
    </MemoryRouter>,
  );
  await screen.findByText(title);
};

describe("the parcel number kept in a property's attributes", () => {
  it("reads it from the attributes and never fails on a bad or missing one", () => {
    expect(parcelOf(JSON.stringify({ parcel_number: "0123/4/A" }))).toBe("0123/4/A");
    expect(parcelOf("")).toBe("");
    expect(parcelOf("not json")).toBe("");
    expect(parcelOf(JSON.stringify({ colour: "red" }))).toBe("");
  });

  it("writes it beside the other attributes and drops it when emptied", () => {
    expect(JSON.parse(withParcel(JSON.stringify({ colour: "red" }), "77/2"))).toEqual({ colour: "red", parcel_number: "77/2" });
    expect(JSON.parse(withParcel("", "77/2"))).toEqual({ parcel_number: "77/2" });
    expect(JSON.parse(withParcel(JSON.stringify({ colour: "red", parcel_number: "77/2" }), ""))).toEqual({ colour: "red" });
  });
});

describe("a property's parcel number on its page", () => {
  it("shows the parcel number as one line on the property's page", async () => {
    await openPlace("a1", "Corner plot");

    expect(await screen.findByText("Parcel number")).toBeTruthy();
    expect(screen.getByText("0123/4/A")).toBeTruthy();
  });

  it("shows no empty line for a property without one", async () => {
    await openPlace("a2", "Market square");

    expect(screen.queryByText("Parcel number")).toBeNull();
  });

  it("lets a caller with asset.manage correct the number and shows it afterwards", async () => {
    await openPlace("a2", "Market square");

    await userEvent.click(await screen.findByRole("button", { name: "Edit" }));
    await userEvent.type(screen.getByLabelText("Parcel number"), "88/1");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(called).toHaveBeenCalledWith("", "assetmanager_asset_update", expect.objectContaining({ assetID: "a2", attributes_json: JSON.stringify({ parcel_number: "88/1" }) })),
    );
    expect(await screen.findByText("88/1")).toBeTruthy();
  });
});

describe("finding a property by its parcel number", () => {
  const renderPlaces = async () => {
    render(
      <MemoryRouter>
        <PlacesPage />
      </MemoryRouter>,
    );
    await screen.findByText("Corner plot");
  };

  it("lists a property without a number and still finds one by typing the number", async () => {
    await renderPlaces();
    expect(screen.getByText("Market square")).toBeTruthy();

    await userEvent.type(screen.getByRole("searchbox"), "0123/4");

    expect(screen.getByText("Corner plot")).toBeTruthy();
    expect(screen.queryByText("Market square")).toBeNull();
  });
});
