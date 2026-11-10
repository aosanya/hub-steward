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
});
