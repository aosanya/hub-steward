import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { forgetOpenAgency, openAgency } from "../agency/open";
import * as mcp from "../wakala/mcp";
import { mcpStepsClient, memberStepOf, refusalWords, StepRefused } from "./api";
import { forgetSent, markSent } from "./sent";

const raw = (over: Record<string, unknown> = {}) => ({
  id: "s1",
  title: "Refer the case",
  kind: "fill_form",
  workflow_id: "w1",
  workflow_name: "Case referral",
  role_id: "r1",
  role_name: "Volunteer",
  form_name: "Referral",
  record_code: "REC-1",
  state: "start",
  questions: [
    { prompt: "Reason", answer_type: "free_text", required: true },
    { prompt: "How soon", answer_type: "single_choice", required: false, options: ["Same day", "This week"] },
  ],
  ...over,
});

const fetched = (status: number, body: unknown = {}) => vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(body), { status }));

beforeEach(() => openAgency("hub1"));

afterEach(() => {
  vi.restoreAllMocks();
  forgetSent();
  forgetOpenAgency();
});

describe("listing what a member may act on now", () => {
  it("asks for the steps available now and reads each form step as a start step or a waiting step with its run", async () => {
    const call = vi.spyOn(mcp, "callTool").mockResolvedValue({ items: [raw(), raw({ id: "s2", state: "waiting", order_id: "o9", form_name: "Confirm" })] });
    const steps = await mcpStepsClient.available();
    expect(call).toHaveBeenCalledWith("", "agency_list_my_open_steps", { available: true });
    expect(steps.map((s) => [s.id, s.state, s.orderId, s.formName, s.recordCode])).toEqual([
      ["s1", "start", "", "Referral", "REC-1"],
      ["s2", "waiting", "o9", "Confirm", "REC-1"],
    ]);
    expect(steps[0].questions[1]).toMatchObject({ prompt: "How soon", answerType: "single_choice", options: ["Same day", "This week"] });
    expect(steps[0].questions[0]).toMatchObject({ prompt: "Reason", required: true });
  });

  it("leaves out an item with no state, which is how the old list looks, a step with no questions and a step that is not a form step", async () => {
    vi.spyOn(mcp, "callTool").mockResolvedValue({ items: [raw({ state: undefined }), raw({ id: "n", questions: [] }), raw({ id: "c", kind: "chat" })] });
    expect(await mcpStepsClient.available()).toEqual([]);
  });

  it("leaves out the start of a step she has sent in this session, so the list shows it once as Sent", async () => {
    markSent({ id: "s1", orderId: "r1", title: "Refer the case" });
    vi.spyOn(mcp, "callTool").mockResolvedValue({ items: [raw(), raw({ id: "s3", form_name: "Other" })] });
    expect((await mcpStepsClient.available()).map((s) => s.id)).toEqual(["s3"]);
  });

  it("keeps a waiting run of a step whose start she sent, and the start of another agency's step with the same id", async () => {
    markSent({ id: "s1", orderId: "r1", title: "Refer the case" });
    vi.spyOn(mcp, "callTool").mockResolvedValue({ items: [raw({ state: "waiting", order_id: "r2" })] });
    expect((await mcpStepsClient.available()).map((s) => s.orderId)).toEqual(["r2"]);
    openAgency("hub2");
    vi.spyOn(mcp, "callTool").mockResolvedValue({ items: [raw()] });
    expect((await mcpStepsClient.available()).map((s) => s.id)).toEqual(["s1"]);
  });

  it("reads nothing from an answer that is not a list", async () => {
    vi.spyOn(mcp, "callTool").mockResolvedValue({});
    expect(await mcpStepsClient.available()).toEqual([]);
  });

  it("gives no step for a raw item whose state is neither start nor waiting", () => {
    expect(memberStepOf(raw({ state: "done" }))).toBeUndefined();
  });
});

describe("sending a step's answers", () => {
  it("posts the answers keyed by prompt to the step, with no run for a start step, and reads the next step the reply carries", async () => {
    const fetch = fetched(201, { step_id: "s1", order_id: "o1", record_code: "REC-1", row_id: "row1", done: true, next_step: raw({ id: "s2", state: "waiting", order_id: "o1", role_name: "Liaison" }) });
    const sent = await mcpStepsClient.submit({ id: "s1", state: "start", orderId: "" }, { Reason: "Needs a clinic check", "Visits this week": "3" });
    const [url, init] = fetch.mock.calls[0];
    expect(String(url)).toBe("https://wakala.test/instances/hub1/steps/s1/answers");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({ answers: { Reason: "Needs a clinic check", "Visits this week": "3" } });
    expect(sent.done).toBe(true);
    expect(sent.orderId).toBe("o1");
    expect(sent.next).toMatchObject({ id: "s2", state: "waiting", orderId: "o1", roleName: "Liaison" });
  });

  it("sends the run with a waiting step and reports no next step after the last", async () => {
    const fetch = fetched(201, { done: true, next_step: null });
    const sent = await mcpStepsClient.submit({ id: "s2", state: "waiting", orderId: "o1" }, { Arrived: "yes" });
    expect(JSON.parse(String(fetch.mock.calls[0][1]?.body))).toEqual({ answers: { Arrived: "yes" }, order_id: "o1" });
    expect(sent).toEqual({ done: true, next: null, orderId: "" });
  });

  it("forgets what it read so the next list is read afresh", async () => {
    fetched(201, { done: true, next_step: null });
    const forget = vi.spyOn(mcp, "forgetReads");
    await mcpStepsClient.submit({ id: "s1", state: "start", orderId: "" }, {});
    expect(forget).toHaveBeenCalled();
  });

  it.each([
    [403, "role"],
    [409, "not-ready"],
    [400, "invalid"],
    [404, "missing"],
    [500, "failed"],
  ])("turns an answer of %i into the reason %s, in plain words", async (status, reason) => {
    fetched(status);
    const failure = await mcpStepsClient.submit({ id: "s1", state: "start", orderId: "" }, {}).catch((e) => e);
    expect(failure).toBeInstanceOf(StepRefused);
    expect(failure.reason).toBe(reason);
    expect(failure.message).toBe(refusalWords[reason as keyof typeof refusalWords]);
  });

  it("names the plain words for a refused role and for a step that is not ready", () => {
    expect(refusalWords.role).toBe("This step is not for your role.");
    expect(refusalWords["not-ready"]).toBe("This step is not ready or was already sent.");
  });

  it("reports a failure to reach the server as a failed send", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("offline"));
    const failure = await mcpStepsClient.submit({ id: "s1", state: "start", orderId: "" }, {}).catch((e) => e);
    expect(failure.reason).toBe("failed");
  });
});
