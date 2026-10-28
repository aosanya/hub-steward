import { act, renderHook } from "@testing-library/react";
import type { TestResult } from "../../data/accounts";
import { McpError } from "../../wakala/mcp";
import { sentenceOf, useTestRun } from "./useTestRun";

type Outcome = TestResult;

const answer: Outcome = { working: true, reason: "", tookMs: 320, prompt: "Reply with the single word OK", reply: "OK" };

const pending = () => {
  let finish: (outcome: Outcome) => void = () => {};
  let fail: (error: unknown) => void = () => {};
  const promise = new Promise<Outcome>((resolve, reject) => {
    finish = resolve;
    fail = reject;
  });
  return { promise, finish, fail };
};

describe("the test run", () => {
  it("starts idle and not busy", () => {
    const { result } = renderHook(() => useTestRun());

    expect(result.current.run).toEqual({ phase: "idle" });
    expect(result.current.busy).toBe(false);
  });

  it("is sending and busy while the call is out, then done with what the call gave", async () => {
    const { result } = renderHook(() => useTestRun());
    const call = pending();

    let started: Promise<void> = Promise.resolve();
    act(() => {
      started = result.current.start(() => call.promise);
    });
    expect(result.current.run).toEqual({ phase: "sending" });
    expect(result.current.busy).toBe(true);

    await act(async () => {
      call.finish(answer);
      await started;
    });

    expect(result.current.run).toEqual({ phase: "done", working: true, reason: "", prompt: answer.prompt, reply: "OK", tookMs: 320 });
    expect(result.current.busy).toBe(false);
  });

  it("keeps a refusal as not working with its reason, prompt and time", async () => {
    const { result } = renderHook(() => useTestRun());

    await act(() => result.current.start(async () => ({ ...answer, working: false, reason: "the model refused the key", reply: "", tookMs: 85 })));

    expect(result.current.run).toEqual({
      phase: "done",
      working: false,
      reason: "the model refused the key",
      prompt: answer.prompt,
      reply: "",
      tookMs: 85,
    });
  });

  it("turns a thrown error into not working with its message, the tool's name dropped, and no prompt, reply or time", async () => {
    const { result } = renderHook(() => useTestRun());

    await act(() => result.current.start(() => Promise.reject(new McpError("ai_test_account: the AI backend did not answer"))));

    expect(result.current.run).toEqual({ phase: "done", working: false, reason: "the AI backend did not answer", prompt: "", reply: "", tookMs: null });
    expect(result.current.busy).toBe(false);
  });

  it("turns a thrown value that is no error into not working with an empty reason", async () => {
    const { result } = renderHook(() => useTestRun());

    await act(() => result.current.start(() => Promise.reject("boom")));

    expect(result.current.run).toMatchObject({ phase: "done", working: false, reason: "" });
  });

  it("goes back to sending when started again, and replaces the earlier outcome", async () => {
    const { result } = renderHook(() => useTestRun());
    await act(() => result.current.start(async () => answer));
    const call = pending();

    let started: Promise<void> = Promise.resolve();
    act(() => {
      started = result.current.start(() => call.promise);
    });
    expect(result.current.run).toEqual({ phase: "sending" });

    await act(async () => {
      call.finish({ ...answer, reply: "Okay", tookMs: 12 });
      await started;
    });

    expect(result.current.run).toMatchObject({ phase: "done", reply: "Okay", tookMs: 12 });
  });

  it("goes back to idle on clear", async () => {
    const { result } = renderHook(() => useTestRun());
    await act(() => result.current.start(async () => answer));

    act(() => result.current.clear());

    expect(result.current.run).toEqual({ phase: "idle" });
  });
});

describe("the sentence of an error", () => {
  it("drops the tool's name and trims", () => {
    expect(sentenceOf(new Error("ai_set_account_key:   the key was refused "))).toBe("the key was refused");
  });

  it("leaves a message without a tool's name as it is", () => {
    expect(sentenceOf(new Error("wakala answered 500: down"))).toBe("wakala answered 500: down");
  });

  it("takes a secret out of the sentence", () => {
    expect(sentenceOf(new Error("rejected sk-123 for good"), "sk-123")).toBe("rejected  for good");
  });

  it("is empty for what is no error", () => {
    expect(sentenceOf("boom")).toBe("");
    expect(sentenceOf(undefined)).toBe("");
  });
});
