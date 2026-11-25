import { vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../shared/wakala/openAgency";
import { fieldKeyOf, liveRecordsHub, rowsAsked, rowsSaved, uuidKey, type FakeRecord } from "../../shared/wakala/liveRecords.test-support";
import { loadDeclaredRecord, loadDeclaredRows, loadDeclaredRow } from "./declaredRecord";
import { loadRecordRow, loadRecordRows, loadRecordRowsHeldBy, loadRowChain } from "./liveRecordRows";
import { loadBusinessChoices } from "./referenceChoices";
import { RecordRowForm } from "./RecordRowForm";
import { loadMaintenanceOf } from "./sections/assets/maintenanceRecords";

vi.mock("../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

const otherKey = "b41d7e52-0c8a-4f36-a1d9-73e5c0f2a8b6";

const businesses: FakeRecord = {
  key: uuidKey,
  code: "business_register",
  name: "Businesses",
  can_add_rows: true,
  questions: ["Trading name", "Kind of business", "Neighbourhood"],
};

const maintenance: FakeRecord = {
  key: otherKey,
  code: "upkeep",
  name: "Maintenance records",
  can_add_rows: true,
  questions: ["Asset", "Date done", "Kind", "What was done"],
};

const bakery = { id: "b1", answers: { "Trading name": "Malomsor Bakery", "Kind of business": "Bakery", Neighbourhood: "Malomsor" } };

const grocer = { id: "b2", answers: { "Trading name": "Zöldkert Grocer", "Kind of business": "Grocer", Neighbourhood: "Óváros" } };

const hubKeeping = () => liveRecordsHub({ records: [businesses, maintenance], rows: { [uuidKey]: [bakery, grocer], [otherKey]: [{ id: "m1", answers: { Asset: "Road roller", "Date done": "2026-11-12", Kind: "Routine", "What was done": "Changed the oil" } }] } });

beforeEach(() => openAgency("town"));

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

describe("a record whose code was renamed and whose key is a UUID", () => {
  it("is found by its key and carries the key, and its prompts come from its questions", async () => {
    hubKeeping();

    const record = await loadDeclaredRecord(uuidKey);

    expect(record?.key).toBe(uuidKey);
    expect(record?.questions.map((question) => question.prompt)).toEqual(["Trading name", "Kind of business", "Neighbourhood"]);
  });

  it("is asked for its rows by its key, and a row's answers are read by the field keys and shown under the prompts", async () => {
    const hub = hubKeeping();

    const rows = await loadDeclaredRows(uuidKey, []);

    expect(rowsAsked(hub)).toEqual([{ record_code: uuidKey }]);
    expect(rows.map((row) => row.answers)).toEqual([bakery.answers, grocer.answers]);
  });

  it("opens one row with its record, its answers and its place in the list", async () => {
    hubKeeping();

    const loaded = await loadDeclaredRow(uuidKey, "b2");

    expect(loaded?.position).toBe(2);
    expect(loaded?.row.answers["Trading name"]).toBe("Zöldkert Grocer");
  });

  it("is listed by the register of Businesses with the title and the meta line from the field keys", async () => {
    const hub = hubKeeping();

    const rows = await loadRecordRows("RC-1", "Trading name", ["Kind of business", "Neighbourhood"]);

    expect(rows.map((row) => [row.title, row.meta])).toEqual([
      ["Malomsor Bakery", "Bakery · Malomsor"],
      ["Zöldkert Grocer", "Grocer · Óváros"],
    ]);
    expect(rowsAsked(hub)).toEqual([{ record_code: uuidKey }]);
  });

  it("is asked for the rows a person holds and for one opened row by its key", async () => {
    const hub = hubKeeping();

    await loadRecordRowsHeldBy("RC-1", "Trading name", [], "a1");
    const opened = await loadRecordRow("RC-1", "b1", ["Trading name", "Neighbourhood"]);
    await loadRowChain("RC-1", "b1");

    expect(opened["Trading name"]).toBe("Malomsor Bakery");
    expect(opened["Neighbourhood"]).toBe("Malomsor");
    expect(rowsAsked(hub).map((asked) => asked.record_code)).toEqual([uuidKey, uuidKey, uuidKey, uuidKey]);
  });

  it("gives the business choices by trading name from the field keys", async () => {
    hubKeeping();

    expect(await loadBusinessChoices()).toEqual([
      { value: "b1", label: "Malomsor Bakery" },
      { value: "b2", label: "Zöldkert Grocer" },
    ]);
  });

  it("gives the maintenance of an asset from the field keys", async () => {
    hubKeeping();

    const done = await loadMaintenanceOf({ id: "a1", name: "Road roller" });

    expect(done.map((one) => one.what)).toEqual(["Changed the oil"]);
  });

  const form = (edit?: { rowId: string; saved: Record<string, string> }) =>
    render(
      <MemoryRouter initialEntries={["/form"]}>
        <Routes>
          <Route path="/form" element={<RecordRowForm title="Add business" recordCode="RC-1" fields={[{ prompt: "Trading name", required: true }, { prompt: "Neighbourhood", required: false }]} back={{ to: "/list", label: "Businesses" }} edit={edit} />} />
          <Route path="/list" element={<p>the businesses</p>} />
        </Routes>
      </MemoryRouter>,
    );

  it("saves a new row into the record's key with the answers under the field keys", async () => {
    const hub = hubKeeping();
    const user = userEvent.setup();
    form();

    await user.type(screen.getByLabelText("Trading name"), "Honey stall");
    await user.type(screen.getByLabelText("Neighbourhood (optional)"), "Malomsor");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("the businesses")).toBeInTheDocument();
    expect(rowsSaved(hub)).toEqual([{ record_code: uuidKey, answers: { [fieldKeyOf("Trading name")]: "Honey stall", [fieldKeyOf("Neighbourhood")]: "Malomsor" } }]);
  });

  it("saves an edit as a replacing row of the record's key with the answers under the field keys", async () => {
    const hub = hubKeeping();
    const user = userEvent.setup();
    form({ rowId: "b1", saved: { "Trading name": "Malomsor Bakery", Neighbourhood: "Malomsor" } });

    const name = screen.getByLabelText("Trading name");
    await user.clear(name);
    await user.type(name, "Malomsor Bread");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(rowsSaved(hub)).toHaveLength(1));
    expect(rowsSaved(hub)[0]).toEqual({ record_code: uuidKey, answers: { [fieldKeyOf("Trading name")]: "Malomsor Bread", [fieldKeyOf("Neighbourhood")]: "Malomsor" }, replaces: "b1" });
  });
});
