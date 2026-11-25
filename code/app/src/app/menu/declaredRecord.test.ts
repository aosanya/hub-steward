import { vi } from "vitest";
import * as mcp from "../../shared/wakala/mcp";
import { forgetOpenAgency, openAgency } from "../../shared/wakala/openAgency";
import { formFieldOf, loadDeclaredRecord, loadDeclaredRows, resolveWhere, type Question } from "./declaredRecord";
import { loadMayAddRows, resolveRecordKey } from "./liveRecordRows";
import { recordServed, rowServed, type FakeRecord } from "../../shared/wakala/liveRecords.test-support";

const farms: FakeRecord = { key: "RC-1", code: "RC-1", name: "Farms", can_add_rows: true, questions: [{ prompt: "Farm name", answer_type: "free_text", required: true }] };
const businesses: FakeRecord = { key: "RC-90", code: "RC-90", name: "Businesses", can_add_rows: false, questions: [] };

beforeEach(() => openAgency("alego"));

afterEach(() => {
  forgetOpenAgency();
  vi.restoreAllMocks();
});

const hubKeeping = () =>
  vi.spyOn(mcp, "callTool").mockImplementation(async (_hub, tool, args) => {
    if (tool === "agency_list_live_records") return { items: [farms, businesses].map(recordServed) };
    return { items: [rowServed(farms, { id: "r1", answers: { "Farm name": "Green Acres" } })].map((row) => ({ ...row, record_code: (args as { record_code: string }).record_code })) };
  });

describe("a declared record whose code is one of the municipality's three registers", () => {
  it("is found by the key as written, never by the register name that key maps to", async () => {
    hubKeeping();
    expect((await loadDeclaredRecord("RC-1"))?.name).toBe("Farms");
    expect((await loadDeclaredRecord("RC-1"))?.canAdd).toBe(true);
  });

  it("asks the rows tool for the key as written", async () => {
    const hub = hubKeeping();
    await loadDeclaredRows("RC-1", []);
    const asked = hub.mock.calls.filter(([, tool]) => tool === "agency_list_live_record_rows").map(([, , args]) => (args as { record_code: string }).record_code);
    expect(asked).toEqual(["RC-1"]);
  });

  it("leaves the municipality's own lookups on the name map", async () => {
    hubKeeping();
    expect(await loadMayAddRows("RC-1")).toBe(false);
    expect(await resolveRecordKey("RC-1")).toBe("RC-90");
  });
});

describe("the twelve answer types of a record's questions", () => {
  const asked = (answerType: string, over: Partial<Question> = {}): Question => ({ prompt: "Q", answerType, required: false, options: [], optionsFrom: "", ...over });

  it.each([
    ["free_text", {}],
    ["number", { kind: "number" }],
    ["currency", { kind: "number" }],
    ["date", { kind: "date" }],
    ["time", { kind: "time" }],
    ["yes_no", { options: ["Yes", "No"] }],
  ])("takes %s as a field of its own kind", (answerType, shape) => {
    expect(formFieldOf(asked(answerType))).toEqual({ prompt: "Q", required: false, ...shape });
  });

  it("takes single_choice and multi_select as choices from the options, the second ticked many", () => {
    expect(formFieldOf(asked("single_choice", { options: ["A", "B"] }))).toEqual({ prompt: "Q", required: false, options: ["A", "B"] });
    expect(formFieldOf(asked("multi_select", { options: ["A", "B"] }))).toEqual({ prompt: "Q", required: false, options: ["A", "B"], multi: true });
  });

  it("takes a question that picks from members as a people picker", () => {
    expect(formFieldOf(asked("single_choice", { optionsFrom: "members" }))).toEqual({ prompt: "Q", required: false, people: true });
  });

  it.each(["photo", "file", "time_range", "address"])("leaves %s out of the form", (answerType) => {
    expect(formFieldOf(asked(answerType))).toBeNull();
  });

  it("turns a placeholder into the tapped row's answer and says so when the row has none", () => {
    const row = { id: "p1", orderId: "", answers: { Title: "Alpha" } };
    expect(resolveWhere([{ question: "Project", operator: "is", value: { row: "Title" } }], row)).toEqual([{ question: "Project", operator: "is", value: "Alpha" }]);
    expect(resolveWhere([{ question: "Project", operator: "is", value: { row: "Nope" } }], row)).toBeNull();
    expect(resolveWhere([{ question: "Village", operator: "is", value: "Alego" }], null)).toEqual([{ question: "Village", operator: "is", value: "Alego" }]);
  });
});
