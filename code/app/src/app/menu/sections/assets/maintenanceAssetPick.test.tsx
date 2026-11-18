import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { loadAssetLabels } from "../../assetChoices";
import { MaintenanceHistory } from "./MaintenanceCard";
import { maintenanceFields, loadMaintenanceOf } from "./maintenanceRecords";
import { routes } from "./index";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

const deleted = "0f0f0f0f-1111-4222-8333-444444444444";

const assets = [
  { id: "as1", name: "Road roller", serial_tag: "A-12", category: "Equipment" },
  { id: "as2", name: "Ring Road", serial_tag: "R-1", category: "Route" },
];

const rowOf = (id: string, asset: string, done: string, what: string) => ({ id, answers: { Asset: asset, "Date done": done, Kind: "Routine", "What was done": what } });

const rows = [
  rowOf("m1", "as1", "2026-11-12", "Changed the hydraulic oil"),
  rowOf("m2", "Road roller A-12", "2026-09-02", "Greased the joints"),
  rowOf("x1", "as2", "2026-10-01", "Patched the surface"),
  rowOf("gone", deleted, "2026-08-01", "Mowed the verge"),
];

let landed = "";

const Where = () => {
  landed = useLocation().pathname + useLocation().search;
  return null;
};

const show = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Where />
      <Routes>{routes()}</Routes>
    </MemoryRouter>,
  );

let called: MockInstance<typeof mcp.callTool>;

beforeEach(() => {
  openAgency("town");
  called = vi.spyOn(mcp, "callTool").mockImplementation(async (_hub, tool) => {
    if (tool === "agency_list_live_records") return { items: [{ code: "RC-268", name: "Maintenance records", can_add_rows: true }] };
    if (tool === "agency_list_live_record_rows") return { items: rows };
    if (tool === "assetmanager_asset_list") return { items: assets };
    if (tool === "agency_add_live_record_row") return { id: "m9" };
    return {};
  });
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

describe("the Asset question of a maintenance record", () => {
  it("is picked from the agency's assets", () => {
    expect(maintenanceFields.find((field) => field.prompt === "Asset")).toMatchObject({ required: true, assets: true });
  });

  it("opens the add screen with the asset it came from chosen and saves that asset's id", async () => {
    const user = userEvent.setup();
    show("/a/town/menu/assets/maintenance-records/new?asset=as1&from=%2Fa%2Ftown%2Fmenu%2Fassets%2Fequipment%3Fitem%3Das1");

    expect(await screen.findByRole("button", { name: /^Asset.*Road roller A-12/ })).toBeInTheDocument();
    await user.type(screen.getByLabelText("Date done"), "2026-11-15");
    await user.click(screen.getByRole("radio", { name: "Routine" }));
    await user.type(screen.getByLabelText("What was done"), "Greased the joints");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(called).toHaveBeenCalledWith("", "agency_add_live_record_row", { record_code: "RC-268", answers: { Asset: "as1", "Date done": "2026-11-15", Kind: "Routine", "What was done": "Greased the joints" } });
    expect(landed).toBe("/a/town/menu/assets/equipment?item=as1");
  });

  it("shows the asset's name and serial tag on the record page, and the edit screen keeps the id", async () => {
    const user = userEvent.setup();
    show("/a/town/menu/assets/maintenance-records/m1");

    const asset = await screen.findByRole("region", { name: "Asset" });
    expect(within(asset).getByText("Road roller A-12")).toBeInTheDocument();
    expect(screen.queryByText("as1")).toBeNull();

    await user.click(within(screen.getByRole("region", { name: "Maintenance detail" })).getByRole("button", { name: "Edit" }));
    expect(await screen.findByRole("button", { name: /^Asset.*Road roller A-12/ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(called).toHaveBeenCalledWith("", "agency_add_live_record_row", expect.objectContaining({ replaces: "m1", answers: expect.objectContaining({ Asset: "as1" }) }));
  });

  it("opens the asset from the record page", async () => {
    const user = userEvent.setup();
    show("/a/town/menu/assets/maintenance-records/m1");

    await user.click(await screen.findByRole("button", { name: /Road roller A-12/ }));

    expect(landed).toBe("/a/town/menu/assets/equipment?item=as1");
  });

  it("never prints an id for an asset that no longer exists", async () => {
    show("/a/town/menu/assets/maintenance-records/gone");

    expect(await screen.findByText("An asset that no longer exists")).toBeInTheDocument();
    expect(screen.queryByText(deleted)).toBeNull();
  });

  it("never prints an id when the asset list cannot be read", async () => {
    called.mockImplementation(async (_hub, tool) => {
      if (tool === "assetmanager_asset_list") throw new Error("down");
      if (tool === "agency_list_live_records") return { items: [{ code: "RC-268", name: "Maintenance records", can_add_rows: true }] };
      if (tool === "agency_list_live_record_rows") return { items: rows };
      return {};
    });
    show("/a/town/menu/assets/maintenance-records/m1");

    expect(await screen.findByText("An asset that could not be read")).toBeInTheDocument();
    expect(screen.queryByText("as1")).toBeNull();
  });
});

describe("the maintenance of one asset", () => {
  it("finds the rows that hold its id and the older rows that name it", async () => {
    const found = await loadMaintenanceOf({ id: "as1", name: "Road roller" });
    expect(found.map((one) => one.id)).toEqual(["m1", "m2"]);
  });

  it("opens the add screen and the list for the asset by its id", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/asset"]}>
        <Where />
        <Routes>
          {routes()}
          <Route path="/asset" element={<MaintenanceHistory assetId="as1" assetName="Road roller" />} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(await screen.findByRole("button", { name: "Add maintenance" }));
    expect(landed).toBe("/a/town/menu/assets/maintenance-records/new?asset=as1&from=%2Fasset");
  });
});

describe("the asset names of a screen", () => {
  it("reads the asset list once when the list and the page ask together", async () => {
    await Promise.all([loadAssetLabels(), loadAssetLabels()]);
    expect(called.mock.calls.filter(([, tool]) => tool === "assetmanager_asset_list")).toHaveLength(1);
  });
});
