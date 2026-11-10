import { vi } from "vitest";
import { callTool } from "../../wakala/mcp";

export type Args = Record<string, unknown>;

export type ToolReply = unknown | ((args: Args) => unknown);

const call = vi.mocked(callTool);

export const answering = (replies: Record<string, ToolReply>) =>
  call.mockImplementation((async (_hub: string, tool: string, args: Args = {}) => {
    const reply = replies[tool];
    if (reply instanceof Error) throw reply;
    if (typeof reply === "function") return reply(args);
    return reply === undefined ? { items: [] } : reply;
  }) as typeof callTool);

export const callsTo = (tool: string) => call.mock.calls.filter(([, name]) => name === tool).map(([, , args]) => args ?? {});
