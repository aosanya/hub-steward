import { afterEach, describe, expect, it, vi } from "vitest";
import * as mcp from "../wakala/mcp";
import { groupOrdersPageSize, listAllGroupOrders } from "./groupOrders";

afterEach(() => vi.restoreAllMocks());

const orders = (from: number, count: number) => Array.from({ length: count }, (_, n) => ({ id: `g${String(from + n).padStart(4, "0")}` }));

const pagesOf = (...pages: unknown[][]) => {
  const call = vi.spyOn(mcp, "callTool");
  pages.forEach((items) => call.mockResolvedValueOnce({ items } as never));
  return call;
};

describe("reading every group order", () => {
  it("asks for the biggest page and reads one short page as everything", async () => {
    const call = pagesOf(orders(0, 3));
    expect(await listAllGroupOrders()).toEqual(orders(0, 3));
    expect(call).toHaveBeenCalledTimes(1);
    expect(call).toHaveBeenCalledWith("", "market_list_group_orders", { limit: 200 });
  });

  it("follows the id of the last order of a full page until a short page", async () => {
    const first = orders(0, groupOrdersPageSize);
    const second = orders(groupOrdersPageSize, groupOrdersPageSize);
    const third = orders(2 * groupOrdersPageSize, 7);
    const call = pagesOf(first, second, third);
    const all = await listAllGroupOrders();
    expect(all).toHaveLength(2 * groupOrdersPageSize + 7);
    expect(all.at(-1)).toEqual(third.at(-1));
    expect(call.mock.calls.map((args) => args[2])).toEqual([
      { limit: 200 },
      { limit: 200, after: first.at(-1)!.id },
      { limit: 200, after: second.at(-1)!.id },
    ]);
  });

  it("passes the caller's own filters on every page", async () => {
    const first = orders(0, groupOrdersPageSize);
    const call = pagesOf(first, orders(groupOrdersPageSize, 2));
    await listAllGroupOrders({ mine: true, state: "open" });
    expect(call.mock.calls.map((args) => args[2])).toEqual([
      { limit: 200, mine: true, state: "open" },
      { limit: 200, mine: true, state: "open", after: first.at(-1)!.id },
    ]);
  });

  it("leaves a filter out of the arguments when it is not asked for", async () => {
    const call = pagesOf(orders(0, 1));
    await listAllGroupOrders({ mine: false, state: "" });
    expect(call).toHaveBeenCalledWith("", "market_list_group_orders", { limit: 200 });
  });

  it("stops after a full page that is followed by an empty one", async () => {
    const first = orders(0, groupOrdersPageSize);
    const call = pagesOf(first, []);
    expect(await listAllGroupOrders()).toEqual(first);
    expect(call).toHaveBeenCalledTimes(2);
  });

  it("stops when the answer ignores after and repeats the page", async () => {
    const first = orders(0, groupOrdersPageSize);
    const call = vi.spyOn(mcp, "callTool").mockResolvedValue({ items: first } as never);
    expect(await listAllGroupOrders()).toEqual(first);
    expect(call).toHaveBeenCalledTimes(2);
  });

  it("reads an answer with no items as no orders", async () => {
    vi.spyOn(mcp, "callTool").mockResolvedValue({} as never);
    expect(await listAllGroupOrders()).toEqual([]);
  });

  it("fails when a later page cannot be read", async () => {
    vi.spyOn(mcp, "callTool")
      .mockResolvedValueOnce({ items: orders(0, groupOrdersPageSize) } as never)
      .mockRejectedValueOnce(new Error("market down"));
    await expect(listAllGroupOrders()).rejects.toThrow("market down");
  });
});
