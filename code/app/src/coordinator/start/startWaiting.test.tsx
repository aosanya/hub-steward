import { act, renderHook, waitFor } from "@testing-library/react";
import { useStartWaiting } from "./startWaiting";

const step = (id: string) => ({ id }) as never;

describe("useStartWaiting", () => {
  it("is empty until the read answers, then holds the steps", async () => {
    const client = { waiting: vi.fn().mockResolvedValue([step("s1"), step("s2")]) };
    const { result } = renderHook(() => useStartWaiting(client));
    expect(result.current).toBeNull();
    await waitFor(() => expect(result.current).toHaveLength(2));
  });

  it("reads once for two readers of the same client", async () => {
    const client = { waiting: vi.fn().mockResolvedValue([step("s1")]) };
    const a = renderHook(() => useStartWaiting(client));
    const b = renderHook(() => useStartWaiting(client));
    await waitFor(() => expect(a.result.current).toHaveLength(1));
    await waitFor(() => expect(b.result.current).toHaveLength(1));
    expect(client.waiting).toHaveBeenCalledTimes(1);
  });

  it("settles to no steps when the read fails", async () => {
    const client = { waiting: vi.fn().mockRejectedValue(new Error("down")) };
    const { result } = renderHook(() => useStartWaiting(client));
    await waitFor(() => expect(result.current).toEqual([]));
  });

  it("reads again for a reader that arrives after every earlier one left", async () => {
    const client = { waiting: vi.fn().mockResolvedValue([step("s1")]) };
    const first = renderHook(() => useStartWaiting(client));
    await waitFor(() => expect(first.result.current).toHaveLength(1));
    first.unmount();
    const second = renderHook(() => useStartWaiting(client));
    expect(second.result.current).toBeNull();
    await act(async () => {});
    await waitFor(() => expect(second.result.current).toHaveLength(1));
    expect(client.waiting).toHaveBeenCalledTimes(2);
  });
});
