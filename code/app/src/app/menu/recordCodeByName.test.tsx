import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../shared/wakala/openAgency";
import * as mcp from "../../shared/wakala/mcp";
import { answersKeyed, recordFrom, recordServed, rowServed } from "../../shared/wakala/liveRecords.test-support";
import { loadRecordRow, loadRecordRows, loadRecordRowsHeldBy } from "./liveRecordRows";
import { RecordRowForm } from "./RecordRowForm";

vi.mock("../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

const bakery = { id: "b1", answers: { "Trading name": "Malomsor Bakery", "Kind of business": "Bakery", Neighbourhood: "Malomsor" } };
const stepRecord = recordFrom("RC-1", "Build the register from what the council already holds", [], [], { can_add_rows: false });
const businesses = recordFrom("RC-266", "Businesses", [bakery]);
const traders = recordFrom("RC-267", "Informal traders", [], ["Name or alias"]);

let called: MockInstance<typeof mcp.callTool>;

const hubKeeping = (records: ReturnType<typeof recordFrom>[] | Error) => {
  called = vi.spyOn(mcp, "callTool").mockImplementation(async (_hub, tool, args) => {
    if (tool === "agency_list_live_records") {
      if (records instanceof Error) throw records;
      return { items: records.map(recordServed) };
    }
    if (tool === "agency_list_live_record_rows") return { items: (args as { record_code: string }).record_code === "RC-266" ? [rowServed(businesses, bakery)] : [] };
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

describe("a register that the hub keeps under another key", () => {
  it("reads the rows of Businesses from the key the hub gave it when it is not RC-1", async () => {
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

  it("reads no rows when the hub names no such record", async () => {
    hubKeeping([stepRecord]);

    expect(await loadRecordRows("RC-1", "Trading name", [])).toEqual([]);
    expect(rowCodesRead()).toEqual([]);
  });

  it("fails to read the rows when the records cannot be listed", async () => {
    hubKeeping(new Error("not allowed"));

    await expect(loadRecordRows("RC-2", "Name or alias", [])).rejects.toThrow("not allowed");
  });

  it("names any other record by its key and finds it in the list", async () => {
    hubKeeping([stepRecord, businesses]);

    await loadRecordRows("RC-266", "Name", []);

    expect(rowCodesRead()).toEqual(["RC-266"]);
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
    expect(called).toHaveBeenCalledWith("", "agency_add_live_record_row", { record_code: "RC-267", answers: answersKeyed(traders, { "Name or alias": "Honey stall" }) });
  });
});
