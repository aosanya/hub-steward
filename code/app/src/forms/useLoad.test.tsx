import { act, renderHook, waitFor } from "@testing-library/react";
import { useLoad } from "./useLoad";

describe("useLoad", () => {
  it("is loading, then ready with the data", async () => {
    const { result } = renderHook(() => useLoad(() => Promise.resolve(["a", "b"]), "k"));
    expect(result.current).toEqual({ state: "loading" });
    await waitFor(() => expect(result.current).toEqual({ state: "ready", data: ["a", "b"] }));
  });

  it("is an error when the load is refused", async () => {
    const { result } = renderHook(() => useLoad(() => Promise.reject(new Error("no")), "k"));
    await waitFor(() => expect(result.current).toEqual({ state: "error" }));
  });

  it("loads again, from loading, when the key changes", async () => {
    const load = vi.fn((key: string) => Promise.resolve(key));
    const { result, rerender } = renderHook(({ key }) => useLoad(() => load(key), key), { initialProps: { key: "one" } });
    await waitFor(() => expect(result.current).toEqual({ state: "ready", data: "one" }));
    rerender({ key: "two" });
    expect(result.current).toEqual({ state: "loading" });
    await waitFor(() => expect(result.current).toEqual({ state: "ready", data: "two" }));
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("ignores an answer that arrives after the key moved on", async () => {
    let releaseFirst: (value: string) => void = () => {};
    const first = new Promise<string>((resolve) => (releaseFirst = resolve));
    const { result, rerender } = renderHook(({ key }) => useLoad(() => (key === "one" ? first : Promise.resolve("second")), key), { initialProps: { key: "one" } });
    rerender({ key: "two" });
    await waitFor(() => expect(result.current).toEqual({ state: "ready", data: "second" }));
    await act(async () => releaseFirst("stale"));
    expect(result.current).toEqual({ state: "ready", data: "second" });
  });
  describe("refreshing", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it("reads again every interval without going back to loading", async () => {
      let n = 0;
      const load = vi.fn(() => Promise.resolve(++n));
      const { result } = renderHook(() => useLoad(load, "k", 30_000));
      await act(async () => {});
      expect(result.current).toEqual({ state: "ready", data: 1 });
      await act(async () => {
        vi.advanceTimersByTime(30_000);
      });
      expect(result.current).toEqual({ state: "ready", data: 2 });
      expect(load).toHaveBeenCalledTimes(2);
    });

    it("keeps the data it has when a refresh fails", async () => {
      const load = vi.fn().mockResolvedValueOnce("first").mockRejectedValueOnce(new Error("no"));
      const { result } = renderHook(() => useLoad(load, "k", 30_000));
      await act(async () => {});
      await act(async () => {
        vi.advanceTimersByTime(30_000);
      });
      expect(result.current).toEqual({ state: "ready", data: "first" });
    });

    it("does not read while the page is hidden", async () => {
      const load = vi.fn(() => Promise.resolve("x"));
      renderHook(() => useLoad(load, "k", 30_000));
      await act(async () => {});
      const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(true);
      await act(async () => {
        vi.advanceTimersByTime(60_000);
      });
      expect(load).toHaveBeenCalledTimes(1);
      hidden.mockRestore();
    });

    it("stops reading once it unmounts", async () => {
      const load = vi.fn(() => Promise.resolve("x"));
      const { unmount } = renderHook(() => useLoad(load, "k", 30_000));
      await act(async () => {});
      unmount();
      await act(async () => {
        vi.advanceTimersByTime(90_000);
      });
      expect(load).toHaveBeenCalledTimes(1);
    });

    it("never refreshes when no interval is given", async () => {
      const load = vi.fn(() => Promise.resolve("x"));
      renderHook(() => useLoad(load, "k"));
      await act(async () => {});
      await act(async () => {
        vi.advanceTimersByTime(300_000);
      });
      expect(load).toHaveBeenCalledTimes(1);
    });
  });
});
