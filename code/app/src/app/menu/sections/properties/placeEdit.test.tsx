import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { routes } from "./index";
import { placePaths } from "./paths";

let called: MockInstance<typeof mcp.callTool>;
let permissions: string[];
let place: Record<string, string>;
let refusal = "";

const answer = async (name: string, args: unknown) => {
  const given = (args ?? {}) as Record<string, string>;
  if (name === "agency_get_my_roles") return { permissions };
  if (name === "assetmanager_asset_read") return { item: place };
  if (name === "assetmanager_location_read") return { item: { id: "l1", name: "Old Town" } };
  if (name === "assetmanager_asset_update") {
    if (refusal) throw new mcp.McpError(`assetmanager_asset_update: ${refusal}`);
    place = { ...place, ...given };
    return {};
  }
  throw new Error(`${name}: unknown tool`);
};

beforeEach(() => {
  openAgency("town");
  permissions = ["asset.manage"];
  refusal = "";
  place = { id: "a2", name: "Market square", category: "Square", location_id: "l1" };
  called = vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => answer(name, args));
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

const openPlace = async () => {
  render(
    <MemoryRouter initialEntries={[placePaths.place.path({ placeId: "a2" })]}>
      <Routes>{routes()}</Routes>
    </MemoryRouter>,
  );
  await screen.findByRole("heading", { level: 1, name: "Market square" });
};

describe("editing a place from its detail", () => {
  it("lets a caller with asset.manage rename it and shows the new name", async () => {
    await openPlace();

    await userEvent.click(await screen.findByRole("button", { name: "Edit" }));
    const name = screen.getByLabelText("Name");
    await userEvent.clear(name);
    await userEvent.type(name, "Main square");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(called).toHaveBeenCalledWith("", "assetmanager_asset_update", { assetID: "a2", name: "Main square" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Main square" })).toBeTruthy();
  });

  it("shows no Edit to a caller without asset.manage", async () => {
    permissions = ["digitaltwin.view"];
    await openPlace();
    await waitFor(() => expect(called).toHaveBeenCalledWith("", "agency_get_my_roles"));

    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
  });

  it("shows the hub's words when it refuses the save", async () => {
    refusal = "name already used";
    await openPlace();

    await userEvent.click(await screen.findByRole("button", { name: "Edit" }));
    await userEvent.type(screen.getByLabelText("Name"), "x");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("name already used")).toBeTruthy();
  });
});
