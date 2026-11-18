import { vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, useLocation } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { routes } from "./index";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

const row = {
  id: "m1",
  answers: { Asset: "Road roller A-12", "Date done": "2026-11-12", Kind: "Repair", "What was done": "Changed the hydraulic oil", "Done by": "Road Repair Crew", Cost: "18500", "Work order": "WO-77" },
};

let may: boolean;
let landed = "";
let saved = false;

const editedRow = { id: "m2", answers: { ...row.answers, "What was done": "Changed the oil and the filter" } };

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

beforeEach(() => {
  saved = false;
  openAgency("town");
  vi.spyOn(mcp, "callTool").mockImplementation(async (_hub, tool) => {
    if (tool === "agency_list_live_records") return { items: [{ code: "RC-268", name: "Maintenance records", can_add_rows: may }] };
    if (tool === "agency_list_live_record_rows") return { items: [saved ? editedRow : row] };
    if (tool === "agency_add_live_record_row") {
      saved = true;
      return { id: "m2" };
    }
    return {};
  });
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

describe("the maintenance record page", () => {
  it("titles the page with what was done, the day as the quiet line, and the fields as plain rows", async () => {
    may = true;
    show("/a/town/menu/assets/maintenance-records/m1");

    expect(await screen.findByRole("heading", { name: "Changed the hydraulic oil" })).toBeInTheDocument();
    const detail = screen.getByRole("region", { name: "Maintenance detail" });
    expect(within(detail).getByText("Road Repair Crew")).toBeInTheDocument();
    expect(within(detail).getByText("2026-11-12")).toBeInTheDocument();
  });

  it("shows the work order card only when one is named", async () => {
    may = true;
    show("/a/town/menu/assets/maintenance-records/m1");

    expect(await within(await screen.findByRole("region", { name: "Work order" })).findByText("WO-77")).toBeInTheDocument();
  });

  it("has Edit in the footer for someone who may add rows, opening the one edit screen", async () => {
    may = true;
    const user = userEvent.setup();
    show("/a/town/menu/assets/maintenance-records/m1");

    await user.click(await within(await screen.findByRole("region", { name: "Maintenance detail" })).findByRole("button", { name: "Edit" }));

    expect(landed).toBe("/a/town/menu/assets/maintenance-records/m1/edit");
  });

  it("has no Edit without the permission", async () => {
    may = false;
    show("/a/town/menu/assets/maintenance-records/m1");

    await screen.findByRole("heading", { name: "Changed the hydraulic oil" });
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
  });
});

describe("the one maintenance edit screen", () => {
  it("opens filled from the record and saves a replacing row, then returns to the record the replacing row made", async () => {
    may = true;
    const user = userEvent.setup();
    show("/a/town/menu/assets/maintenance-records/m1/edit");

    const what = await screen.findByLabelText("What was done");
    expect(what).toHaveValue("Changed the hydraulic oil");
    expect(screen.getByLabelText("Date done")).toHaveAttribute("type", "date");
    await user.clear(what);
    await user.type(what, "Changed the oil and the filter");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(vi.mocked(mcp.callTool)).toHaveBeenCalledWith("", "agency_add_live_record_row", expect.objectContaining({ record_code: "RC-268", replaces: "m1", answers: expect.objectContaining({ "What was done": "Changed the oil and the filter" }) }));
    expect(await screen.findByRole("heading", { name: "Changed the oil and the filter" })).toBeInTheDocument();
    expect(landed).toBe("/a/town/menu/assets/maintenance-records/m2");
    expect(screen.queryByText("This could not be loaded.")).toBeNull();
  });

  it("adds a row for the asset it was opened from and returns to the page it came from", async () => {
    may = true;
    const user = userEvent.setup();
    show("/a/town/menu/assets/maintenance-records/new?asset=Road+roller+A-12&from=%2Fa%2Ftown%2Fmenu%2Fassets%2Fequipment%3Fitem%3De1");

    expect(await screen.findByLabelText("Asset")).toHaveValue("Road roller A-12");
    await user.type(screen.getByLabelText("Date done"), "2026-11-15");
    await user.click(screen.getByRole("radio", { name: "Routine" }));
    await user.type(screen.getByLabelText("What was done"), "Greased the joints");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(vi.mocked(mcp.callTool)).toHaveBeenCalledWith("", "agency_add_live_record_row", { record_code: "RC-268", answers: { Asset: "Road roller A-12", "Date done": "2026-11-15", Kind: "Routine", "What was done": "Greased the joints" } });
    expect(landed).toBe("/a/town/menu/assets/equipment?item=e1");
  });
});
