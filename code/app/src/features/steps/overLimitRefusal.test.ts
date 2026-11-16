import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { forgetOpenAgency, openAgency } from "../../shared/wakala/openAgency";
import { mcpStepsClient, refusalWords, StepRefused } from "./api";
import { serverSentenceOf } from "./overLimitRefusal";
import { forgetSent } from "./sent";

const sentence = "The amount 720 000 Ft is above the limit of 500 000 Ft written to your role. Another role must approve it.";
const step = { id: "s1", state: "start" as const, orderId: "" };
const reply = (status: number, body: string) => vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(body, { status }));
const refusal = async () => mcpStepsClient.submit(step, { Amount: "720000" }, "k1").catch((e) => e);

beforeEach(() => openAgency("hub1"));

afterEach(() => {
  vi.restoreAllMocks();
  forgetSent();
  forgetOpenAgency();
});

describe("the over-limit refusal", () => {
  it("shows the server's sentence for a 422", async () => {
    reply(422, JSON.stringify({ error: sentence }));
    const failure = await refusal();
    expect(failure).toBeInstanceOf(StepRefused);
    expect(failure.reason).toBe("over-limit");
    expect(failure.message).toBe(sentence);
  });

  it("falls back to the fixed sentence when the body has none", async () => {
    for (const body of ["", "{}", "not json", JSON.stringify({ error: "  " })]) {
      reply(422, body);
      const failure = await refusal();
      expect(failure.reason).toBe("over-limit");
      expect(failure.message).toBe(refusalWords["over-limit"]);
    }
    expect(refusalWords["over-limit"]).toBe("This amount is above your approval limit.");
  });

  it("keeps the usual words for other statuses", async () => {
    reply(400, JSON.stringify({ error: sentence }));
    const invalid = await refusal();
    expect(invalid.reason).toBe("invalid");
    expect(invalid.message).toBe(refusalWords.invalid);
    reply(403, JSON.stringify({ error: sentence }));
    expect((await refusal()).message).toBe(refusalWords.role);
  });

  it("reads the sentence out of a response body", async () => {
    expect(await serverSentenceOf(new Response(JSON.stringify({ error: sentence })))).toBe(sentence);
    expect(await serverSentenceOf(new Response(""))).toBe("");
  });
});
