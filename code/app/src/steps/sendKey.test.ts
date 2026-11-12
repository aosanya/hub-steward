import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { forgetOpenAgency, openAgency } from "../agency/open";
import { mcpStepsClient, sendTimeoutMs, StepRefused } from "./api";

const fetched = (status: number, body: unknown = {}) => vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(body), { status }));

const bodyOf = (fetch: ReturnType<typeof fetched>) => JSON.parse(String(fetch.mock.calls[0][1]?.body));

beforeEach(() => openAgency("hub1"));

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  forgetOpenAgency();
});

describe("a send that can be repeated safely", () => {
  it("carries the send key of the opening with the answers of a start step", async () => {
    const fetch = fetched(201, { done: true });
    await mcpStepsClient.submit({ id: "s1", state: "start", orderId: "" }, { Reason: "Fever" }, "opening-1");
    expect(bodyOf(fetch)).toEqual({ answers: { Reason: "Fever" }, send_key: "opening-1" });
  });

  it("sends a waiting step with its run and no key, because the run already makes it one send", async () => {
    const fetch = fetched(201, { done: true });
    await mcpStepsClient.submit({ id: "s2", state: "waiting", orderId: "o1" }, { Arrived: "yes" }, "opening-2");
    expect(bodyOf(fetch)).toEqual({ answers: { Arrived: "yes" }, order_id: "o1" });
  });

  it("takes an answer of already sent as a send that went through", async () => {
    fetched(409, { error: "already sent" });
    const sent = await mcpStepsClient.submit({ id: "s2", state: "waiting", orderId: "o1" }, {}, "opening-2");
    expect(sent).toEqual({ done: false, next: null, orderId: "o1" });
  });

  it("gives up after the time limit with the reason timeout and plain words", async () => {
    vi.useFakeTimers();
    vi.spyOn(globalThis, "fetch").mockImplementation(
      (_url, init) => new Promise((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")))),
    );
    const failure = mcpStepsClient.submit({ id: "s1", state: "start", orderId: "" }, {}, "opening-1").catch((e) => e);
    await vi.advanceTimersByTimeAsync(sendTimeoutMs);
    const caught = await failure;
    expect(caught).toBeInstanceOf(StepRefused);
    expect(caught.reason).toBe("timeout");
    expect(caught.message).toBe("This is taking too long. Try again.");
  });
});
