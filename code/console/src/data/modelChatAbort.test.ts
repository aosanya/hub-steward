import { beforeEach, describe, expect, it, vi } from "vitest";
import { callTool, listTools, type ToolInfo } from "../wakala/mcp";
import { askModel, chatTool, type Turn } from "./modelChat";

vi.mock("../wakala/mcp", async (importOriginal) => ({ ...(await importOriginal<object>()), callTool: vi.fn(), listTools: vi.fn() }));

const callToolMock = vi.mocked(callTool);

const tool = (name: string): ToolInfo => ({ name, description: `about ${name}`, inputSchema: { type: "object" } });

const turns: Turn[] = [{ role: "user", content: "Review the goals." }];

const calledTools = () => callToolMock.mock.calls.map((call) => call[1]);

beforeEach(() => {
  callToolMock.mockReset();
  vi.mocked(listTools).mockResolvedValue([tool("agency_list_goals"), tool(chatTool)]);
});

describe("asking the model with a signal", () => {
  it("hands the signal to the model call", async () => {
    const signal = new AbortController().signal;
    callToolMock.mockResolvedValue({ message: { role: "assistant", content: "Done." } });
    await askModel("h1", "a1", turns, "goals", "", signal);
    expect(callToolMock).toHaveBeenCalledWith("h1", chatTool, expect.anything(), signal);
  });

  it("sends nothing when it is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(askModel("h1", "a1", turns, "goals", "", controller.signal)).rejects.toThrow();
    expect(calledTools()).not.toContain(chatTool);
  });

  it("runs no tool the model asked for once it is aborted", async () => {
    const controller = new AbortController();
    callToolMock.mockImplementation(async (_hub, name) => {
      if (name !== chatTool) return { items: [] };
      controller.abort();
      return { message: { role: "assistant", content: "", tool_calls: [{ id: "t1", name: "agency_list_goals", arguments: {} }] } };
    });
    await expect(askModel("h1", "a1", turns, "goals", "", controller.signal)).rejects.toThrow();
    expect(calledTools()).toEqual([chatTool]);
  });
});
