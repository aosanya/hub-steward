import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../shared/wakala/openAgency";
import * as mcp from "../../shared/wakala/mcp";
import { loadRecordRow, loadRecordRows, loadRecordRowsHeldBy } from "./liveRecordRows";
import { RecordRowForm } from "./RecordRowForm";

vi.mock("../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

const stepRecord = { code: "RC-1", name: "Build the register from what the council already holds", can_add_rows: false };
const businesses = { code: "RC-266", name: "Businesses", can_add_rows: true };
const traders = { code: "RC-267", name: "Informal traders", can_add_rows: true };
const bakery = { id: "b1", answers: { "Trading name": "Malomsor Bakery", "Kind of business": "Bakery", Neighbourhood: "Malomsor" } };

let called: MockInstance<typeof mcp.callTool>;

const hubKeeping = (records: unknown[] | Error) => {
  called = vi.spyOn(mcp, "callTool").mockImplementation(async (_hub, tool, args) => {
    if (tool === "agency_list_live_records") {
      if (records instanceof Error) throw records;
      return { items: records };
    }
    if (tool === "agency_list_live_record_rows") return { items: (args as { record_code: string }).record_code === "RC-266" ? [bakery] : [] };
    return { id: "r1" };
  });
};

const rowCodesRead = () => called.mock.calls.filter(([, tool]) => tool === "agency_list_live_record_rows").map(([, , args]) => (args as { record_code: string }).record_code);

beforeEach(() => openAgency("town"));

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

describe("a register that the hub keeps under another code", () => {
  it("reads the rows of Businesses from the code the hub gave it when it is not RC-1", async () => {
    hubKeeping([stepRecord, businesses, traders]);

    const rows = await loadRecordRows("RC-1", "Trading name", ["Kind of business"]);

    expect(rows.map((row) => row.title)).toEqual(["Malomsor Bakery"]);
    expect(rowCodesRead()).toEqual(["RC-266"]);
  });

  it("reads Informal traders from RC-267 and a person's rows and one opened row the same way", async () => {
    hubKeeping([stepRecord, businesses, traders]);

    await loadRecordRowsHeldBy("RC-2", "Name or alias", [], "a1");
    await loadRecordRow("RC-2", "t1", ["Name or alias"]);

    expect(rowCodesRead()).toEqual(["RC-267", "RC-267"]);
  });

  it("keeps the code it was given when the hub names no such record", async () => {
    hubKeeping([stepRecord]);

    await loadRecordRows("RC-1", "Trading name", []);

    expect(rowCodesRead()).toEqual(["RC-1"]);
  });

  it("keeps the code it was given when the records cannot be listed", async () => {
    hubKeeping(new Error("not allowed"));

    await loadRecordRows("RC-2", "Name or alias", []);

    expect(rowCodesRead()).toEqual(["RC-2"]);
  });

  it("leaves any other code alone and does not list the records", async () => {
    hubKeeping([stepRecord, businesses]);

    await loadRecordRows("RC-9", "Name", []);

    expect(rowCodesRead()).toEqual(["RC-9"]);
    expect(called.mock.calls.some(([, tool]) => tool === "agency_list_live_records")).toBe(false);
  });

  it("saves the new row of Informal traders into the record the hub gave it", async () => {
    hubKeeping([stepRecord, businesses, traders]);
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/form"]}>
        <Routes>
          <Route path="/form" element={<RecordRowForm title="Add trader" recordCode="RC-2" fields={[{ prompt: "Name or alias", required: true }]} back={{ to: "/list", label: "Traders" }} />} />
          <Route path="/list" element={<p>the traders</p>} />
        </Routes>
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText("Name or alias"), "Honey stall");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("the traders")).toBeInTheDocument();
    expect(called).toHaveBeenCalledWith("", "agency_add_live_record_row", { record_code: "RC-267", answers: { "Name or alias": "Honey stall" } });
  });
});
