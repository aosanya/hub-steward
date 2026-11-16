import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { items, routes } from "./index";

let called: MockInstance<typeof mcp.callTool>;
let permissions: string[];
let roller: Record<string, string>;

const answer = async (name: string, args: unknown) => {
  const given = (args ?? {}) as Record<string, string>;
  if (name === "agency_list_mounts") return { modules: [{ module: "assetmanager" }] };
  if (name === "agency_get_my_roles") return { permissions };
  if (name === "assetmanager_asset_list") return { items: [roller] };
  if (name === "assetmanager_asset_read") return { item: roller };
  if (name === "assetmanager_location_list") return { items: [] };
  if (name === "assetmanager_movement_list") return { items: [] };
  if (name === "assetmanager_asset_update") {
    roller = { ...roller, ...given };
    return {};
  }
  throw new Error(`${name}: unknown tool`);
};

beforeEach(() => {
  openAgency("town");
  permissions = ["asset.manage"];
  roller = { id: "e1", code: "A-12", name: "Road roller", category: "Equipment" };
  called = vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => answer(name, args));
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

const openRoller = async () => {
  const path = items.find((item) => item.title === "Equipment")?.path?.() ?? "";
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>{routes()}</Routes>
    </MemoryRouter>,
  );
  await userEvent.click(await screen.findByRole("button", { name: /Road roller/ }));
};

describe("editing an asset from its detail", () => {
  it("lets a caller with asset.manage rename it and shows the new name", async () => {
    await openRoller();

    await userEvent.click(await screen.findByRole("button", { name: "Edit" }));
    const name = screen.getByLabelText("Name");
    await userEvent.clear(name);
    await userEvent.type(name, "Heavy roller");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(called).toHaveBeenCalledWith("", "assetmanager_asset_update", { assetID: "e1", name: "Heavy roller" }));
    expect((await screen.findAllByText("Heavy roller")).length).toBeGreaterThan(1);
  });

  it("shows no Edit to a caller without asset.manage", async () => {
    permissions = ["asset.view"];
    await openRoller();

    await screen.findByText("A-12");
    await waitFor(() => expect(called).toHaveBeenCalledWith("", "agency_get_my_roles"));

    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
  });
});
