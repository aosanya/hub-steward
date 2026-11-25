import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { BookClient, Refs } from "./bookClient";
import { useRefs } from "./useRefs";

const refsOf = (code: string): Refs => ({ cameFrom: [{ id: `i-${code}`, code: `ISS-${code}` }], files: [] });

const codes = (count: number) => Array.from({ length: count }, (_, n) => `R-${n + 1}`);

const gated = () => {
  const pending: { code: string; release: () => void }[] = [];
  let running = 0;
  let most = 0;
  const refs = vi.fn(
    (code: string) =>
      new Promise<Refs>((resolve) => {
        running += 1;
        most = Math.max(most, running);
        pending.push({
          code,
          release: () => {
            running -= 1;
            resolve(refsOf(code));
          },
        });
      }),
  );
  const client: BookClient = { rules: async () => ({ state: "ready", data: [] }), refs };
  return { client, refs, pending, most: () => most };
};

const settle = () => act(async () => new Promise((resolve) => setTimeout(resolve, 0)));

describe("the references of the Book, read behind the reader", () => {
  it("starts with nothing and fills one rule at a time as reads arrive", async () => {
    const { client, pending } = gated();
    const { result } = renderHook(() => useRefs(client, ["R-1", "R-2"]));
    expect(result.current).toEqual({});
    await waitFor(() => expect(pending).toHaveLength(2));
    await act(async () => pending[1].release());
    expect(Object.keys(result.current)).toEqual(["R-2"]);
    await act(async () => pending[0].release());
    expect(result.current["R-1"]).toEqual(refsOf("R-1"));
  });

  it("reads at most four rules at once and in document order", async () => {
    const { client, refs, pending, most } = gated();
    renderHook(() => useRefs(client, codes(10)));
    await waitFor(() => expect(pending).toHaveLength(4));
    expect(refs.mock.calls.map((call) => call[0])).toEqual(["R-1", "R-2", "R-3", "R-4"]);
    await act(async () => pending[0].release());
    await waitFor(() => expect(pending).toHaveLength(5));
    expect(refs.mock.calls[4][0]).toBe("R-5");
    expect(most()).toBe(4);
  });

  it("reads each of 25 rules exactly once", async () => {
    const refs = vi.fn(async (code: string) => refsOf(code));
    const client: BookClient = { rules: async () => ({ state: "ready", data: [] }), refs };
    const { result } = renderHook(() => useRefs(client, codes(25)));
    await waitFor(() => expect(Object.keys(result.current)).toHaveLength(25));
    expect(refs).toHaveBeenCalledTimes(25);
    expect(new Set(refs.mock.calls.map((call) => call[0])).size).toBe(25);
  });

  it("leaves a rule whose read throws without references and reads the others", async () => {
    const refs = vi.fn(async (code: string) => {
      if (code === "R-2") throw new Error("boom");
      return refsOf(code);
    });
    const client: BookClient = { rules: async () => ({ state: "ready", data: [] }), refs };
    const { result } = renderHook(() => useRefs(client, codes(3)));
    await waitFor(() => expect(Object.keys(result.current).sort()).toEqual(["R-1", "R-3"]));
  });

  it("starts no read after the screen is gone", async () => {
    const { client, refs, pending } = gated();
    const { unmount } = renderHook(() => useRefs(client, codes(10)));
    await waitFor(() => expect(pending).toHaveLength(4));
    unmount();
    await act(async () => pending.forEach((one) => one.release()));
    await settle();
    expect(refs).toHaveBeenCalledTimes(4);
  });

  it("keeps a late answer for a rule that has left the list out of the result", async () => {
    const { client, pending } = gated();
    const { result, rerender } = renderHook(({ list }) => useRefs(client, list), { initialProps: { list: ["R-1"] } });
    await waitFor(() => expect(pending).toHaveLength(1));
    rerender({ list: ["R-2"] });
    await waitFor(() => expect(pending).toHaveLength(2));
    await act(async () => pending[0].release());
    await settle();
    expect(result.current).toEqual({});
    await act(async () => pending[1].release());
    expect(Object.keys(result.current)).toEqual(["R-2"]);
  });

  it("reads nothing for no rules", async () => {
    const { client, refs } = gated();
    renderHook(() => useRefs(client, []));
    await settle();
    expect(refs).not.toHaveBeenCalled();
  });
});
