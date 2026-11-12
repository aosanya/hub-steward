import { beforeEach, describe, expect, it, vi } from "vitest";
import { callTool } from "../../wakala/mcp";
import { mcpTodoCountsClient, todoCountsOfItems, todoCountTools } from "./api";

vi.mock("../../wakala/mcp", () => ({ callTool: vi.fn() }));

beforeEach(() => {
  vi.mocked(callTool).mockReset();
});

describe("the counts of many issues come from one tool call", () => {
  it("asks the tool once with every issue id", async () => {
    vi.mocked(callTool).mockResolvedValue({ items: [{ task_id: "a", done: 2, total: 6 }] });
    expect(await mcpTodoCountsClient.counts(["a", "b", "c"])).toEqual({ a: { done: 2, total: 6 } });
    expect(callTool).toHaveBeenCalledTimes(1);
    expect(callTool).toHaveBeenCalledWith("", todoCountTools.counts, { task_id: ["a", "b", "c"] });
  });

  it("names the tool the hub declares", () => {
    expect(todoCountTools.counts).toBe("taskmanager_task_todo_count_for_issues");
  });

  it("keeps only usable items", () => {
    expect(todoCountsOfItems({ items: [{ task_id: "a", done: 0, total: 0 }, { task_id: "b", done: 1, total: 2 }, { done: 1, total: 2 }, { task_id: "c", done: "1", total: 2 }] })).toEqual({ b: { done: 1, total: 2 } });
    expect(todoCountsOfItems(null)).toEqual({});
  });

  it("lets a failed call reject so the card shows no pill", async () => {
    vi.mocked(callTool).mockImplementation(async () => {
      throw new Error("down");
    });
    expect(await mcpTodoCountsClient.counts(["a"]).then(() => "answered", (error: Error) => error.message)).toBe("down");
  });
});
