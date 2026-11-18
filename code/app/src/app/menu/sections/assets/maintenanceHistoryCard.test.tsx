import { vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { MaintenanceHistory } from "./MaintenanceCard";

const records = [{ code: "RC-268", name: "Maintenance records", can_add_rows: true }];

const rowOf = (id: string, asset: string, done: string, what: string, extra: Record<string, string> = {}) => ({ id, answers: { Asset: asset, "Date done": done, Kind: "Routine", "What was done": what, ...extra } });

const rows = [
  rowOf("m1", "Road roller A-12", "2026-11-12", "Changed the hydraulic oil", { "Done by": "Road Repair Crew" }),
  rowOf("m2", "Road roller A-12", "2026-09-02", "Greased the joints"),
  rowOf("m3", "Road roller A-12", "2026-06-20", "Replaced a hose", { Kind: "Repair" }),
  rowOf("m4", "Road roller A-12", "2026-03-01", "Checked the brakes", { Kind: "Inspection" }),
  rowOf("x1", "Ring Road R-1", "2026-10-01", "Patched the surface"),
];

let may: boolean;
let landed = "";

const Where = () => {
  landed = useLocation().pathname + useLocation().search;
  return null;
};

const show = () =>
  render(
    <MemoryRouter initialEntries={["/asset"]}>
      <Where />
      <Routes>
        <Route path="/asset" element={<MaintenanceHistory assetId="e1" assetName="Road roller" />} />
        <Route path="*" element={<p>elsewhere</p>} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  openAgency("town");
  vi.spyOn(mcp, "callTool").mockImplementation(async (_hub, tool) => {
    if (tool === "agency_list_live_records") return { items: records.map((record) => ({ ...record, can_add_rows: may })) };
    if (tool === "agency_list_live_record_rows") return { items: rows };
    return {};
  });
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

describe("MaintenanceHistory", () => {
  it("shows the newest three maintenance records of this asset only, with the count and See all", async () => {
    may = true;
    show();

    const card = await screen.findByRole("region", { name: "Maintenance history" });
    expect(await within(card).findByText("Changed the hydraulic oil")).toBeInTheDocument();
    expect(within(card).getByText("Greased the joints")).toBeInTheDocument();
    expect(within(card).getByText("Replaced a hose")).toBeInTheDocument();
    expect(within(card).queryByText("Checked the brakes")).toBeNull();
    expect(within(card).queryByText("Patched the surface")).toBeNull();
    expect(within(card).getByRole("button", { name: "See all 4" })).toBeInTheDocument();
  });

  it("gives each row the date and who did it as its lighter line and the kind as a tag", async () => {
    may = true;
    show();

    const card = await screen.findByRole("region", { name: "Maintenance history" });
    expect(await within(card).findByText(/2026-11-12.*Road Repair Crew|Road Repair Crew.*2026-11-12/)).toBeInTheDocument();
    expect(within(card).getAllByText("Routine").length).toBeGreaterThan(0);
    expect(within(card).getByText("Repair")).toBeInTheDocument();
  });

  it("opens the record page from a row", async () => {
    may = true;
    const user = userEvent.setup();
    show();

    await user.click(await screen.findByRole("button", { name: /Changed the hydraulic oil/ }));

    expect(landed).toBe("/a/town/menu/assets/maintenance-records/m1");
  });

  it("opens the list of every maintenance record of this asset from See all", async () => {
    may = true;
    const user = userEvent.setup();
    show();

    await user.click(await screen.findByRole("button", { name: "See all 4" }));

    expect(landed).toBe("/a/town/menu/assets/maintenance-records?name=Road+roller&id=e1&from=%2Fasset");
  });

  it("offers Add maintenance only to someone who may add rows, and opens the one add screen for this asset", async () => {
    may = true;
    const user = userEvent.setup();
    show();

    await user.click(await screen.findByRole("button", { name: "Add maintenance" }));

    expect(landed).toBe("/a/town/menu/assets/maintenance-records/new?asset=e1&from=%2Fasset");
  });

  it("hides Add maintenance without the permission", async () => {
    may = false;
    show();

    await screen.findByText("Changed the hydraulic oil");
    expect(screen.queryByRole("button", { name: "Add maintenance" })).toBeNull();
  });

  it("says so when nothing is recorded yet", async () => {
    may = true;
    rows.splice(0, rows.length);
    show();

    expect(await screen.findByText("No maintenance recorded yet.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add maintenance" })).toBeInTheDocument();
  });
});
