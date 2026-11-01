import { afterEach, describe, expect, it, vi } from "vitest";
import * as mcp from "../wakala/mcp";
import { formsWaiting, provideWaitingCount, restoreWaitingCount, waitingCount } from "./waiting";
import { words } from "./words";

afterEach(() => {
  restoreWaitingCount();
  vi.restoreAllMocks();
});

describe("how many forms are waiting", () => {
  it("counts the items the tool returns", async () => {
    const spy = vi.spyOn(mcp, "callTool").mockResolvedValue({ items: [{}, {}, {}] } as never);
    expect(await waitingCount("a1")).toBe(3);
    expect(spy).toHaveBeenCalledWith("a1", "forms_form_list_waiting");
  });

  it.each([{}, { items: null }, { items: "x" }])("counts none for %j", async (reply) => {
    vi.spyOn(mcp, "callTool").mockResolvedValue(reply as never);
    expect(await waitingCount("a1")).toBe(0);
  });

  it("lets a refused call reach the caller", async () => {
    vi.spyOn(mcp, "callTool").mockRejectedValue(new mcp.McpError("not signed in", true));
    await expect(waitingCount("a1")).rejects.toThrow("not signed in");
  });

  it("uses a provided counter until restored", async () => {
    provideWaitingCount(async (id) => id.length);
    expect(await waitingCount("abcd")).toBe(4);
    restoreWaitingCount();
    vi.spyOn(mcp, "callTool").mockResolvedValue({ items: [] } as never);
    expect(await waitingCount("abcd")).toBe(0);
  });
});

describe("the words for the count", () => {
  it("uses the singular for one", () => {
    expect(formsWaiting(1, words)).toBe("1 form waiting");
  });

  it.each([0, 2, 12])("uses the plural for %i", (count) => {
    expect(formsWaiting(count, words)).toBe(`${count} forms waiting`);
  });
});
