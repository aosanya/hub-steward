import { vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, useLocation } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { routes } from "./index";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

const rowOf = (id: string, asset: string, done: string, what: string, kind = "Routine") => ({ id, answers: { Asset: asset, "Date done": done, Kind: kind, "What was done": what } });

const rows = [
  rowOf("m4", "Road roller A-12", "2026-03-01", "Checked the brakes", "Inspection"),
  rowOf("m1", "Road roller A-12", "2026-11-12", "Changed the hydraulic oil"),
  rowOf("m3", "Road roller A-12", "2026-06-20", "Replaced a hose", "Repair"),
  rowOf("m2", "Road roller A-12", "2026-09-02", "Greased the joints"),
  rowOf("x1", "Ring Road R-1", "2026-10-01", "Patched the surface"),
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

const listPath = "/a/town/menu/assets/maintenance-records?name=Road+roller&from=%2Fa%2Ftown%2Fmenu%2Fassets%2Fequipment%3Fitem%3De1";

beforeEach(() => {
  openAgency("town");
  vi.spyOn(mcp, "callTool").mockImplementation(async (_hub, tool) => {
    if (tool === "agency_list_live_records") return { items: [{ code: "RC-268", name: "Maintenance records", can_add_rows: true }] };
    if (tool === "agency_list_live_record_rows") return { items: rows };
    return {};
  });
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

describe("the list of every maintenance record of an asset", () => {
  it("shows every record of this asset and no other, newest first, under the asset's name", async () => {
    show(listPath);

    const card = await screen.findByRole("region", { name: "Maintenance history" });
    const titles = (await within(card).findAllByText(/hydraulic oil|brakes|hose|joints|surface/)).map((node) => node.textContent);
    expect(titles).toEqual(["Changed the hydraulic oil", "Greased the joints", "Replaced a hose", "Checked the brakes"]);
    expect(screen.getByRole("heading", { level: 1, name: "Road roller" })).toBeInTheDocument();
  });

  it("has a filter strip by kind and a search over the records", async () => {
    const user = userEvent.setup();
    show(listPath);

    const card = await screen.findByRole("region", { name: "Maintenance history" });
    await within(card).findByText("Changed the hydraulic oil");
    await user.click(within(card).getByRole("tab", { name: /Repair/ }));
    expect(within(card).getByText("Replaced a hose")).toBeInTheDocument();
    expect(within(card).queryByText("Greased the joints")).toBeNull();
    await user.click(within(card).getByRole("tab", { name: /All/ }));
    await user.type(within(card).getByRole("searchbox"), "brakes");
    expect(within(card).getByText("Checked the brakes")).toBeInTheDocument();
    expect(within(card).queryByText("Replaced a hose")).toBeNull();
  });

  it("opens the record page from a row", async () => {
    const user = userEvent.setup();
    show(listPath);

    await user.click(await screen.findByRole("button", { name: /Changed the hydraulic oil/ }));

    expect(landed).toBe("/a/town/menu/assets/maintenance-records/m1");
  });

  it("goes back to the asset page it came from", async () => {
    const user = userEvent.setup();
    show(listPath);

    await screen.findByText("Changed the hydraulic oil");
    await user.click(screen.getAllByRole("button", { name: /Back|Road roller/ })[0]);

    expect(landed).toBe("/a/town/menu/assets/equipment?item=e1");
  });

  it("says so when the asset has no maintenance records", async () => {
    show("/a/town/menu/assets/maintenance-records?name=Fountain&from=%2Fa%2Ftown%2Fmenu%2Fassets%2Fequipment");

    expect(await screen.findByText("No maintenance recorded yet.")).toBeInTheDocument();
  });
});
