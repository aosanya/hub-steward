import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { FailureCtx } from "./failureContext";
import { LoadingCtx } from "./loadingContext";
import { useLoaded } from "./useLoaded";

function later<T>() {
  let settle: (value: T) => void = () => {};
  let refuse: (failure: unknown) => void = () => {};
  const promise = new Promise<T>((resolve, reject) => {
    settle = resolve;
    refuse = reject;
  });
  return { promise, settle, refuse };
}

describe("useLoaded", () => {
  it("is loading until the read answers and then holds the value", async () => {
    const { result } = renderHook(() => useLoaded(() => Promise.resolve("rows"), []));
    expect(result.current.state.kind).toBe("loading");
    await waitFor(() => expect(result.current.state).toMatchObject({ kind: "ready", value: "rows" }));
  });

  it("is failed when the read rejects", async () => {
    const { result } = renderHook(() => useLoaded(() => Promise.reject(new Error("down")), []));
    await waitFor(() => expect(result.current.state.kind).toBe("failed"));
  });

  it("is failed when the read throws before it returns a promise", async () => {
    const { result } = renderHook(() =>
      useLoaded<string>(() => {
        throw new Error("sync");
      }, []),
    );
    await waitFor(() => expect(result.current.state.kind).toBe("failed"));
  });

  it("holds the shown value while a reload is read and counts each answer", async () => {
    const reads = [later<number>(), later<number>()];
    const read = vi.fn(() => reads[read.mock.calls.length - 1].promise);
    const { result } = renderHook(() => useLoaded(read, []));
    await act(async () => reads[0].settle(1));
    expect(result.current.state).toEqual({ kind: "ready", value: 1 });
    expect(result.current.received).toBe(1);
    act(() => result.current.reload());
    expect(result.current.state).toEqual({ kind: "ready", value: 1 });
    await act(async () => reads[1].settle(2));
    expect(result.current.state).toEqual({ kind: "ready", value: 2 });
    expect(result.current.received).toBe(2);
  });

  it("goes back to loading when its inputs change and ignores the answer to the old inputs", async () => {
    const first = later<string>();
    const second = later<string>();
    const { result, rerender } = renderHook(({ id }) => useLoaded(() => (id === "a" ? first.promise : second.promise), [id]), {
      initialProps: { id: "a" },
    });
    rerender({ id: "b" });
    await act(async () => first.settle("old"));
    expect(result.current.state.kind).toBe("loading");
    await act(async () => second.settle("new"));
    expect(result.current.state).toMatchObject({ kind: "ready", value: "new" });
  });

  it("goes back to loading when its inputs change after an answer, not showing the old value for the new inputs", async () => {
    const first = later<string>();
    const second = later<string>();
    const { result, rerender } = renderHook(({ id }) => useLoaded(() => (id === "a" ? first.promise : second.promise), [id]), {
      initialProps: { id: "a" },
    });
    await act(async () => first.settle("old"));
    expect(result.current.state).toEqual({ kind: "ready", value: "old" });
    rerender({ id: "b" });
    expect(result.current.state.kind).toBe("loading");
    await act(async () => second.settle("new"));
    expect(result.current.state).toMatchObject({ kind: "ready", value: "new" });
  });

  it("counts only answers that arrived, not a failed read", async () => {
    const reads = [later<number>(), later<number>(), later<number>()];
    const read = vi.fn(() => reads[read.mock.calls.length - 1].promise);
    const { result } = renderHook(() => useLoaded(read, []));
    await act(async () => reads[0].refuse(new Error("down")));
    expect(result.current.state.kind).toBe("failed");
    expect(result.current.received).toBe(0);
    act(() => result.current.reload());
    await act(async () => reads[1].settle(5));
    expect(result.current.received).toBe(1);
    act(() => result.current.reload());
    await act(async () => reads[2].refuse(new Error("down again")));
    expect(result.current.state.kind).toBe("failed");
    expect(result.current.received).toBe(1);
  });

  it("tells the page frame it is loading and withdraws that when it has answered", async () => {
    const report = vi.fn();
    const wrapper = ({ children }: { children: ReactNode }) => <LoadingCtx.Provider value={report}>{children}</LoadingCtx.Provider>;
    const { result } = renderHook(() => useLoaded(() => Promise.resolve("rows"), []), { wrapper });
    await waitFor(() => expect(result.current.state.kind).toBe("ready"));
    expect(report.mock.calls).toEqual([[1], [-1]]);
  });

  describe("telling the page frame what failed", () => {
    const frame = () => {
      const report = vi.fn();
      const wrapper = ({ children }: { children: ReactNode }) => <FailureCtx.Provider value={report}>{children}</FailureCtx.Provider>;
      return { report, wrapper };
    };

    it("reports the plain reason when the read rejects", async () => {
      const { report, wrapper } = frame();
      renderHook(() => useLoaded(() => Promise.reject(new Error("wakala answered 502:\n  gateway down")), []), { wrapper });
      await waitFor(() => expect(report).toHaveBeenCalledWith(expect.any(String), "wakala answered 502: gateway down"));
    });

    it("reports nothing to read when the answer was a sign-out, since the console sends the person to sign in", async () => {
      const { report, wrapper } = frame();
      const signedOut = Object.assign(new Error("not signed in"), { unauthorized: true });
      const { result } = renderHook(() => useLoaded(() => Promise.reject(signedOut), []), { wrapper });
      await waitFor(() => expect(result.current.state.kind).toBe("failed"));
      expect(report).not.toHaveBeenCalledWith(expect.any(String), "not signed in");
    });

    it("withdraws the reason when a later read answers", async () => {
      const { report, wrapper } = frame();
      const reads = [later<number>(), later<number>()];
      const read = vi.fn(() => reads[read.mock.calls.length - 1].promise);
      const { result } = renderHook(() => useLoaded(read, []), { wrapper });
      await act(async () => reads[0].refuse(new Error("down")));
      act(() => result.current.reload());
      await act(async () => reads[1].settle(1));
      expect(report.mock.calls.map(([, reason]) => reason)).toEqual(["down", null]);
    });

    it("withdraws the reason when the page goes away", async () => {
      const { report, wrapper } = frame();
      const { unmount } = renderHook(() => useLoaded(() => Promise.reject(new Error("down")), []), { wrapper });
      await waitFor(() => expect(report).toHaveBeenCalledWith(expect.any(String), "down"));
      unmount();
      expect(report).toHaveBeenLastCalledWith(expect.any(String), null);
    });
  });
});
