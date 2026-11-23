import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { forgetOpenAgency, openAgency } from "../../shared/wakala/openAgency";
import * as mcp from "../../shared/wakala/mcp";
import { mcpStartClient } from "../market";
import { mcpStepsClient, memberStepOf } from "./api";
import { forgetSent, markSent } from "./sent";

const generatedRaw = (over: Record<string, unknown> = {}) => ({
  id: "g-add",
  title: "Add a tender",
  kind: "fill_form",
  workflow_id: "w-add",
  workflow_name: "Add a tender",
  role_name: "Tender Scout",
  form_name: "Tender",
  record_code: "RC-1",
  state: "start",
  generated: true,
  row_action: "add",
  questions: [
    { prompt: "Title", answer_type: "free_text", required: true },
    { prompt: "Value", answer_type: "currency", required: false },
    { prompt: "Lots", answer_type: "number", required: false },
  ],
  ...over,
});

const designedRaw = { id: "d1", title: "Screen a call", kind: "fill_form", workflow_name: "Pipeline", form_name: "Screen", state: "start", questions: [{ prompt: "Go", answer_type: "yes_no", required: true }] };

const fetched = (status: number, body: unknown = {}) => vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(body), { status }));

beforeEach(() => openAgency("hub1"));

afterEach(() => {
  vi.restoreAllMocks();
  forgetSent();
  forgetOpenAgency();
});

describe("a step of a generated workflow read from the hub", () => {
  it("keeps whether it is generated, its row action, the workflow that replaces it and its record", () => {
    const step = memberStepOf(generatedRaw({ replaced_by: "W-9", row_action: "edit" }));
    expect(step).toMatchObject({ generated: true, rowAction: "edit", replacedBy: "W-9", recordCode: "RC-1" });
  });

  it("is a plain step when the hub says nothing of the kind", () => {
    const step = memberStepOf(designedRaw);
    expect(step?.generated).toBeUndefined();
    expect(step?.rowAction).toBeUndefined();
    expect(step?.replacedBy).toBeUndefined();
  });

  it("ignores a row action it does not know", () => {
    expect(memberStepOf(generatedRaw({ row_action: "burn" }))?.rowAction).toBeUndefined();
  });
});

describe("listing what a member may act on now", () => {
  it("lists a generated step again after one was sent, because it is run once for every row", async () => {
    markSent({ id: "g-add", orderId: "", title: "Add a tender" });
    vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, tool) => (tool === "agency_list_my_open_steps" ? { items: [generatedRaw(), designedRaw] } : { items: [] }));
    expect((await mcpStepsClient.available()).map((step) => step.id)).toEqual(["g-add", "d1"]);
  });

  it("still leaves out a designed start step that was sent", async () => {
    markSent({ id: "d1", orderId: "", title: "Screen" });
    vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, tool) => (tool === "agency_list_my_open_steps" ? { items: [generatedRaw(), designedRaw] } : { items: [] }));
    expect((await mcpStepsClient.available()).map((step) => step.id)).toEqual(["g-add"]);
  });
});

describe("the start client", () => {
  const replyTo = (steps: unknown[]) =>
    vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, tool) => (tool === "agency_list_my_open_steps" ? { items: steps } : tool === "agency_get_agency" ? { name: "Farmers" } : {}));

  it("never takes a generated Add for a group order start, whatever it asks", async () => {
    replyTo([generatedRaw()]);
    expect(await mcpStartClient.waiting()).toEqual([]);
  });

  it("leaves generated steps out of the open steps, which only name designed workflows", async () => {
    replyTo([generatedRaw(), designedRaw]);
    expect((await mcpStartClient.openSteps()).map((step) => step.id)).toEqual(["d1"]);
  });
});

describe("sending the answers of a step that changes a row", () => {
  const bodyOf = (fetch: ReturnType<typeof fetched>) => JSON.parse(String(fetch.mock.calls[0][1]?.body));

  it("sends the row id of an edit with the answers and the send key", async () => {
    const fetch = fetched(201, { done: true, row_id: "r9", record_code: "RC-1" });
    const sent = await mcpStepsClient.submit({ id: "g-edit", state: "start", orderId: "", rowId: "r1" }, { Title: "Bridge" }, "key-1");
    expect(bodyOf(fetch)).toEqual({ answers: { Title: "Bridge" }, row_id: "r1", send_key: "key-1" });
    expect(sent).toEqual({ done: true, next: null, orderId: "", rowId: "r9" });
  });

  it("sends no row id with an add, and reads the new row from the reply", async () => {
    const fetch = fetched(201, { done: true, row_id: "r10", record_code: "RC-1" });
    const sent = await mcpStepsClient.submit({ id: "g-add", state: "start", orderId: "" }, { Title: "Road" }, "key-2");
    expect(bodyOf(fetch)).toEqual({ answers: { Title: "Road" }, send_key: "key-2" });
    expect(sent.rowId).toBe("r10");
  });

  it("says a refusal of the role as the role's", async () => {
    fetched(403, { error: "forbidden" });
    await expect(mcpStepsClient.submit({ id: "g-delete", state: "start", orderId: "", rowId: "r1" }, {}, "key-3")).rejects.toMatchObject({ reason: "role" });
  });
});
