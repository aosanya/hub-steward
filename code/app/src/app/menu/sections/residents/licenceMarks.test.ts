import { vi, type MockInstance } from "vitest";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { servedAsHub } from "../../registerHub.test-support";
import { loadLicenceMarks } from "./licensedRows";

type Args = Record<string, unknown>;
type Row = Record<string, unknown>;

const entry = { slug: "trading-licence", name: "Trading Licence", kind: "licence", form_id: "f-licence" };
const validQuestion = { id: "q-valid", form_id: "f-licence", prompt: "Valid until" };
const otherQuestion = { id: "q-premises", form_id: "f-licence", prompt: "Name of the premises" };

const approved = (id: string, rowId: string): Row => ({ id, form_id: "f-licence", member_id: `m-${id}`, record_row_id: rowId, decision: "approved", decided_at: "2026-03-09T12:00:00Z" });
const validUntil = (sendId: string, value: string): Row => ({ id: `a-${sendId}`, member_id: `m-${sendId}`, question_id: validQuestion.id, value_date: value });
const premises = (sendId: string): Row => ({ id: `p-${sendId}`, member_id: `m-${sendId}`, question_id: otherQuestion.id, value_text: "Fő tér 2" });

let sends: Row[];
let answers: Row[];
let questions: Row[];
let history: Row[];
let refused: string;
let called: MockInstance<typeof mcp.callTool>;

const business = (id: string): Row => ({ id, answers: { "Trading name": id } });

beforeEach(() => {
  openAgency("town");
  sends = [];
  answers = [];
  questions = [validQuestion, otherQuestion];
  history = [];
  refused = "";
  called = vi.spyOn(mcp, "callTool").mockImplementation(async (_agency: string, name: string, args?: unknown) => {
    const given = (args ?? {}) as Args;
    if (name === refused) throw new Error(`${name}: permission denied`);
    if (name === "agency_list_live_record_rows") return { items: given.history ? history : [business("b1"), business("b2"), business("b3")] };
    if (name === "forms_catalog_entry_list_public") return { items: [entry] };
    if (name === "forms_submission_list") return { items: sends.filter((row) => row.form_id === given.form_id) };
    if (name === "forms_question_list") return { items: given.form_id === "f-licence" ? questions : [] };
    if (name === "forms_answer_list_all") return { items: given.form_id === "f-licence" ? answers : [] };
    return { items: [] };
  });
  servedAsHub(called);
});

afterEach(() => {
  forgetOpenAgency();
  vi.restoreAllMocks();
});

describe("the three words a business can read", () => {
  it("a licence valid until today or later reads Licensed", async () => {
    sends = [approved("s1", "b1")];
    answers = [validUntil("s1", "2099-12-31"), premises("s1")];

    const marks = await loadLicenceMarks("RC-1", "2026-11-18");

    expect(marks?.get("b1")).toBe("Licensed");
  });

  it("a licence valid until today still reads Licensed", async () => {
    sends = [approved("s1", "b1")];
    answers = [validUntil("s1", "2026-11-18")];

    expect((await loadLicenceMarks("RC-1", "2026-11-18"))?.get("b1")).toBe("Licensed");
  });

  it("a licence valid until an earlier day reads Expired", async () => {
    sends = [approved("s1", "b1")];
    answers = [validUntil("s1", "2026-11-17")];

    expect((await loadLicenceMarks("RC-1", "2026-11-18"))?.get("b1")).toBe("Expired");
  });

  it("a business with no licence application reads Not licensed", async () => {
    sends = [approved("s1", "b1")];
    answers = [validUntil("s1", "2099-12-31")];

    expect((await loadLicenceMarks("RC-1", "2026-11-18"))?.get("b2")).toBe("Not licensed");
  });

  it("a licence with no valid-until answer reads Licensed", async () => {
    sends = [approved("s1", "b1")];
    answers = [premises("s1")];

    expect((await loadLicenceMarks("RC-1", "2026-11-18"))?.get("b1")).toBe("Licensed");
  });

  it("a licence form with no valid-until question reads Licensed", async () => {
    questions = [otherQuestion];
    sends = [approved("s1", "b1")];
    answers = [premises("s1")];

    expect((await loadLicenceMarks("RC-1", "2026-11-18"))?.get("b1")).toBe("Licensed");
  });

  it("an expired licence beside a renewed one reads Licensed", async () => {
    sends = [approved("s1", "b1"), approved("s2", "b1")];
    answers = [validUntil("s1", "2025-01-31"), validUntil("s2", "2099-01-31")];

    expect((await loadLicenceMarks("RC-1", "2026-11-18"))?.get("b1")).toBe("Licensed");
  });

  it("a corrected business takes the expiry of the application that named its older row", async () => {
    history = [business("b1")];
    sends = [approved("s1", "b1")];
    answers = [validUntil("s1", "2025-01-31")];
    called.mockImplementation(async (_agency: string, name: string, args?: unknown) => {
      const given = (args ?? {}) as Args;
      if (name === "agency_list_live_record_rows") return { items: given.history ? history : [{ ...business("b9"), replaces: "b1" }] };
      if (name === "forms_catalog_entry_list_public") return { items: [entry] };
      if (name === "forms_submission_list") return { items: sends.filter((row) => row.form_id === given.form_id) };
      if (name === "forms_question_list") return { items: given.form_id === "f-licence" ? questions : [] };
      if (name === "forms_answer_list_all") return { items: given.form_id === "f-licence" ? answers : [] };
      return { items: [] };
    });
    servedAsHub(called);

    expect((await loadLicenceMarks("RC-1", "2026-11-18"))?.get("b9")).toBe("Expired");
  });

  it("a refused lookup of the sends gives no marks", async () => {
    refused = "forms_submission_list";

    expect(await loadLicenceMarks("RC-1", "2026-11-18")).toBeNull();
  });

  it("a refused lookup of the answers gives no marks", async () => {
    sends = [approved("s1", "b1")];
    refused = "forms_answer_list_all";

    expect(await loadLicenceMarks("RC-1", "2026-11-18")).toBeNull();
  });
});
