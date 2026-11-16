import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { loadFromList, pageByKey, usePagedRoster, type RosterLoad } from "./usePagedRoster";

const people = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `m${i}` }));
const key = (p: { id: string }) => p.id;

describe("paging a list by key", () => {
  it("has no next page when fewer than the limit came back", () => {
    expect(pageByKey(people(2), 3, key).next).toBeUndefined();
  });

  it("points at the last item when a full page came back", () => {
    expect(pageByKey(people(3), 3, key).next).toBe("m2");
  });

  it("has no next page for an empty list", () => {
    expect(pageByKey([], 0, key).next).toBeUndefined();
  });

  it("loads pages from a whole list and ends on the last one", async () => {
    const load = loadFromList(people(5), key);
    const first = await load(2, "", "");
    const second = await load(2, first.next!, "");
    const third = await load(2, second.next!, "");
    expect([first.items, second.items, third.items].map((p) => p.map(key))).toEqual([["m0", "m1"], ["m2", "m3"], ["m4"]]);
    expect(third.next).toBeUndefined();
  });

  it("restarts from the top when the key is not in the list", async () => {
    const page = await loadFromList(people(3), key)(2, "gone", "");
    expect(page.items.map(key)).toEqual(["m0", "m1"]);
  });
});

describe("the roster hook", () => {
  it("starts loading and then shows the first page", async () => {
    const { result } = renderHook(() => usePagedRoster({ load: loadFromList(people(3), key), pageSize: 2 }));
    expect(result.current.status).toBe("loading");
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.items).toHaveLength(2);
    expect(result.current.more).toBe(true);
  });

  it("shows an error when the first page fails", async () => {
    const { result } = renderHook(() => usePagedRoster({ load: () => Promise.reject(new Error("down")) }));
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.items).toEqual([]);
    expect(result.current.more).toBe(false);
  });

  it("is ready and empty when there are no people", async () => {
    const { result } = renderHook(() => usePagedRoster({ load: async () => ({ items: [], next: "stale" }) }));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.items).toEqual([]);
    expect(result.current.more).toBe(false);
  });

  it("appends the next page and stops at the end", async () => {
    const { result } = renderHook(() => usePagedRoster({ load: loadFromList(people(3), key), pageSize: 2 }));
    await waitFor(() => expect(result.current.more).toBe(true));
    act(() => result.current.showMore());
    await waitFor(() => expect(result.current.items).toHaveLength(3));
    expect(result.current.more).toBe(false);
  });

  it("keeps the shown people and offers a retry when more fails", async () => {
    let fail = true;
    const load: RosterLoad<{ id: string }> = async (limit, after, term) => {
      if (after !== "" && fail) throw new Error("down");
      return loadFromList(people(3), key)(limit, after, term);
    };
    const { result } = renderHook(() => usePagedRoster({ load, pageSize: 2 }));
    await waitFor(() => expect(result.current.more).toBe(true));
    act(() => result.current.showMore());
    await waitFor(() => expect(result.current.moreFailed).toBe(true));
    expect(result.current.items).toHaveLength(2);
    expect(result.current.more).toBe(true);
    fail = false;
    act(() => result.current.showMore());
    await waitFor(() => expect(result.current.items).toHaveLength(3));
    expect(result.current.moreFailed).toBe(false);
  });

  it("asks once when showMore is pressed twice at once", async () => {
    const calls = vi.fn(loadFromList(people(6), key));
    const { result } = renderHook(() => usePagedRoster({ load: calls, pageSize: 2 }));
    await waitFor(() => expect(result.current.more).toBe(true));
    act(() => {
      result.current.showMore();
      result.current.showMore();
    });
    await waitFor(() => expect(result.current.items).toHaveLength(4));
    expect(calls).toHaveBeenCalledTimes(2);
  });

  it("does nothing on showMore when there is no more", async () => {
    const calls = vi.fn(loadFromList(people(1), key));
    const { result } = renderHook(() => usePagedRoster({ load: calls, pageSize: 2 }));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    act(() => result.current.showMore());
    expect(calls).toHaveBeenCalledTimes(1);
  });

  it("starts over and drops the old people when the search term changes", async () => {
    const load: RosterLoad<{ id: string }> = async (_l, _a, term) => ({ items: [{ id: `hit-${term}` }] });
    const { result, rerender } = renderHook(({ term }) => usePagedRoster({ load, term }), { initialProps: { term: "a" } });
    await waitFor(() => expect(result.current.items.map(key)).toEqual(["hit-a"]));
    rerender({ term: "b" });
    expect(result.current.status).toBe("loading");
    expect(result.current.items).toEqual([]);
    await waitFor(() => expect(result.current.items.map(key)).toEqual(["hit-b"]));
  });

  it("ignores a slow answer for an old search term", async () => {
    let releaseOld: (page: { items: { id: string }[] }) => void = () => {};
    const load: RosterLoad<{ id: string }> = (_l, _a, term) =>
      term === "old" ? new Promise((resolve) => (releaseOld = resolve)) : Promise.resolve({ items: [{ id: "new" }] });
    const { result, rerender } = renderHook(({ term }) => usePagedRoster({ load, term }), { initialProps: { term: "old" } });
    rerender({ term: "new" });
    await waitFor(() => expect(result.current.items.map(key)).toEqual(["new"]));
    await act(async () => releaseOld({ items: [{ id: "old" }] }));
    expect(result.current.items.map(key)).toEqual(["new"]);
  });

  it("ignores a slow next page that arrives after the term changed", async () => {
    let releaseMore: (page: { items: { id: string }[] }) => void = () => {};
    const load: RosterLoad<{ id: string }> = (_l, after, term) =>
      after !== "" ? new Promise((resolve) => (releaseMore = resolve)) : Promise.resolve({ items: [{ id: `first-${term}` }], next: "k" });
    const { result, rerender } = renderHook(({ term }) => usePagedRoster({ load, term }), { initialProps: { term: "a" } });
    await waitFor(() => expect(result.current.more).toBe(true));
    act(() => result.current.showMore());
    rerender({ term: "b" });
    await waitFor(() => expect(result.current.items.map(key)).toEqual(["first-b"]));
    await act(async () => releaseMore({ items: [{ id: "late-a" }] }));
    expect(result.current.items.map(key)).toEqual(["first-b"]);
  });
});
