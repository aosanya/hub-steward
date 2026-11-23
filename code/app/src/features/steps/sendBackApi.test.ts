import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { forgetOpenAgency, openAgency } from "../../shared/wakala/openAgency";
import { mcpStepsClient, memberStepOf, refusalWords, StepRefused } from "./api";

const raw = (over: Record<string, unknown> = {}) => ({
  id: "s2",
  title: "Approve for submission",
  kind: "fill_form",
  state: "waiting",
  order_id: "o1",
  record_code: "REC-2",
  questions: [{ prompt: "Approved", answer_type: "yes_no", required: true }],
  ...over,
});

const fetched = (status: number, body: unknown = {}) => vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(body), { status }));

const step = { id: "s2", orderId: "o1" };

beforeEach(() => openAgency("hub1"));

afterEach(() => {
  vi.restoreAllMocks();
  forgetOpenAgency();
});

describe("a step the platform can send back", () => {
  it("reads the prompts of the decision and of the reason from send_back", () => {
    expect(memberStepOf(raw({ send_back: { decision: "Approved", reason: "Reason" } }))?.sendBack).toEqual({ decision: "Approved", reason: "Reason" });
  });

  it("offers no send back when the step says nothing or names no prompt", () => {
    expect(memberStepOf(raw())?.sendBack).toBeUndefined();
    expect(memberStepOf(raw({ send_back: { decision: "Approved" } }))?.sendBack).toBeUndefined();
  });
});

describe("sending a step back", () => {
  it("posts the run, the reason and the key to the step's send-back route and reads the role it went to", async () => {
    const fetch = fetched(201, { step_id: "s1", order_id: "o1", role_name: "Service Line Lead" });
    const sent = await mcpStepsClient.sendBack!(step, "The price sheet is not signed", "k1");
    const [url, init] = fetch.mock.calls[0];
    expect(String(url)).toBe("https://wakala.test/instances/hub1/steps/s2/send-back");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({ order_id: "o1", reason: "The price sheet is not signed", send_key: "k1" });
    expect(sent).toEqual({ orderId: "o1", roleName: "Service Line Lead" });
  });

  it.each([
    [403, "role"],
    [400, "invalid"],
    [404, "missing"],
    [409, "not-ready"],
    [500, "failed"],
  ])("turns an answer of %i into the reason %s, in plain words", async (status, reason) => {
    fetched(status);
    const failure = await mcpStepsClient.sendBack!(step, "Because", "k1").catch((e) => e);
    expect(failure).toBeInstanceOf(StepRefused);
    expect(failure.reason).toBe(reason);
    expect(failure.message).toBe(refusalWords[reason as keyof typeof refusalWords]);
  });

  it("reports a failure to reach the server as a failed send", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("offline"));
    const failure = await mcpStepsClient.sendBack!(step, "Because", "k1").catch((e) => e);
    expect(failure.reason).toBe("failed");
  });
});
