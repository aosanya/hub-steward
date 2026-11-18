import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../shared/wakala/openAgency";
import * as mcp from "../../shared/wakala/mcp";
import { loadRecordRow, loadRecordRows } from "./liveRecordRows";
import { RecordRowForm } from "./RecordRowForm";

vi.mock("../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

let called: MockInstance<typeof mcp.callTool>;

const assets = [
  { id: "as1", name: "Road roller", serial_tag: "SN-4471" },
  { id: "as2", name: "Water pump", serial_tag: "" },
];

const people = [{ id: "a1", display_name: "Szabó Katalin" }];

const fields = [
  { prompt: "Asset", required: true, assets: true },
  { prompt: "What was done", required: true },
  { prompt: "Done by", required: false, people: true },
];

const row = { id: "row1", answers: { Asset: "as1", "What was done": "Oil change" } };

const answerFor = (tool: string) => {
  if (tool === "assetmanager_asset_list") return { items: assets };
  if (tool === "actor_list_actors") return { items: people };
  if (tool === "agency_list_live_record_rows") return { items: [row, { id: "row2", answers: { Asset: "Old free text", "What was done": "Wash" } }] };
  if (tool === "agency_list_live_records") return { items: [{ name: "Maintenance records", code: "RC-268" }] };
  return { id: "r1" };
};

const show = () =>
  render(
    <MemoryRouter initialEntries={["/form"]}>
      <Routes>
        <Route path="/form" element={<RecordRowForm title="Add maintenance" recordCode="RC-3" fields={fields} back={{ to: "/list", label: "Records" }} />} />
        <Route path="/list" element={<p>the records</p>} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  openAgency("town");
  called = vi.spyOn(mcp, "callTool").mockImplementation(async (_hub, tool) => answerFor(tool));
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

describe("an asset question in a record form", () => {
  it("lists the agency's assets by name and serial tag and saves the chosen asset id", async () => {
    const user = userEvent.setup();
    show();

    await user.type(screen.getByLabelText("What was done"), "Oil change");
    await user.click(await screen.findByRole("button", { name: /^Asset/ }));
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(["No asset", "Road roller SN-4471", "Water pump"]);
    await user.click(screen.getByRole("option", { name: "Road roller SN-4471" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    await screen.findByText("the records");
    expect(called).toHaveBeenCalledWith("", "agency_add_live_record_row", { record_code: "RC-268", answers: { Asset: "as1", "What was done": "Oil change" } });
  });

  it("reads the asset list once and does not ask for the assets when no question needs them", async () => {
    show();
    await screen.findByRole("button", { name: /^Asset/ });
    expect(called.mock.calls.filter(([, tool]) => tool === "assetmanager_asset_list")).toHaveLength(1);

    cleanup();
    called.mockClear();
    render(
      <MemoryRouter>
        <RecordRowForm title="Add" recordCode="RC-3" fields={[{ prompt: "Name", required: true }]} back={{ to: "/list", label: "Records" }} />
      </MemoryRouter>,
    );
    expect(called.mock.calls.filter(([, tool]) => tool === "assetmanager_asset_list")).toHaveLength(0);
  });

  it("leaves a person question as it was", async () => {
    const user = userEvent.setup();
    show();
    await user.click(await screen.findByRole("button", { name: /Done by/ }));
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(["No one", "Szabó Katalin"]);
  });
});

describe("an asset answer on a record row", () => {
  it("shows the asset's name and serial tag on the row, one asset read for the whole list, and keeps old free text", async () => {
    const rows = await loadRecordRows("RC-3", "Asset", ["What was done"], ["Asset"]);
    expect(rows.map((one) => one.title)).toEqual(["Road roller SN-4471", "Old free text"]);
    expect(called.mock.calls.filter(([, tool]) => tool === "assetmanager_asset_list")).toHaveLength(1);
  });

  it("shows the name on the row page but hands the edit form the asset id", async () => {
    expect((await loadRecordRow("RC-3", "row1", ["Asset", "What was done"], undefined, ["Asset"])).Asset).toBe("Road roller SN-4471");
    expect((await loadRecordRow("RC-3", "row1", ["Asset", "What was done"])).Asset).toBe("as1");
  });
});
