import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../agency/open";
import { routes } from "../routes";
import { AssistantPage } from "./AssistantPage";
import { askAssistant, mcpAssistantClient, offeredNames } from "./api";
import { cancelledResult, createTool, moveTool, rulesTool, unconfirmedResult, writeLines } from "./confirm";

const mcp = vi.hoisted(() => ({ callTool: vi.fn(), listTools: vi.fn() }));

vi.mock("../wakala/mcp", () => ({ callTool: mcp.callTool, listTools: mcp.listTools, McpError: class extends Error {} }));

beforeEach(() => {
  openAgency("farmers");
  mcp.callTool.mockReset();
  mcp.listTools.mockReset();
});

afterEach(() => forgetOpenAgency());

const tool = (name: string) => ({ name, description: name, inputSchema: { type: "object", properties: { instance_id: { type: "string" } }, required: ["instance_id"] } });

const move = { id: "c1", name: moveTool, arguments: { taskID: "t4", backlog: "b1", step: "Doing" } };

const modelWanting = (call: typeof move) =>
  mcp.callTool.mockImplementation(async (_hub: string, name: string, args: Record<string, unknown>) => {
    if (name === "ai_chat_account") {
      const sent = args.messages as { role: string; content: string }[];
      const reply = sent.find((message) => message.role === "tool");
      return reply ? { message: { content: reply.content } } : { message: { content: "", tool_calls: [call] } };
    }
    if (name === "ai_list_chat_models") return { items: [{ id: "acc1", picked: true }] };
    if (name === "agency_list_publications") return { items: [] };
    return { ok: true };
  });

const writesSent = () => mcp.callTool.mock.calls.filter((call) => call[1] === moveTool);

describe("the assistant's write tools", () => {
  it("offers the move, the backlog create and the rules change besides the reads", () => {
    expect(offeredNames).toEqual(expect.arrayContaining([moveTool, createTool, rulesTool]));
  });

  it("does not send a write the person has not confirmed, and tells the model it was cancelled", async () => {
    mcp.listTools.mockResolvedValue(offeredNames.map(tool));
    modelWanting(move);
    const answer = await askAssistant("acc1", [{ role: "user", content: "move 4 to Doing" }], () => undefined, async () => false);
    expect(writesSent()).toHaveLength(0);
    expect(answer.text).toBe(cancelledResult);
  });

  it("sends a confirmed write once", async () => {
    mcp.listTools.mockResolvedValue(offeredNames.map(tool));
    modelWanting(move);
    const confirm = vi.fn().mockResolvedValue(true);
    await askAssistant("acc1", [{ role: "user", content: "move 4 to Doing" }], () => undefined, confirm);
    expect(confirm).toHaveBeenCalledWith({ tool: moveTool, arguments: move.arguments }, []);
    expect(writesSent()).toEqual([["", moveTool, move.arguments]]);
  });

  it("refuses a write when nothing can ask the person", async () => {
    mcp.listTools.mockResolvedValue(offeredNames.map(tool));
    modelWanting(move);
    const answer = await askAssistant("acc1", [{ role: "user", content: "move 4 to Doing" }]);
    expect(writesSent()).toHaveLength(0);
    expect(answer.text).toBe(unconfirmedResult);
  });

  it("runs a read without asking", async () => {
    mcp.listTools.mockResolvedValue(offeredNames.map(tool));
    modelWanting({ id: "c2", name: "taskmanager_task_list", arguments: {} } as typeof move);
    const confirm = vi.fn();
    await askAssistant("acc1", [{ role: "user", content: "list" }], () => undefined, confirm);
    expect(confirm).not.toHaveBeenCalled();
  });

  it("reads the rules of a new smart backlog back in words", () => {
    const lines = writeLines({ tool: createTool, arguments: { name: "Ready to start", rules: { match: "all", rules: [{ field: "mark", operator: "is", value: "Ready" }, { field: "step", operator: "is", value: "To do" }] } } });
    expect(lines).toEqual(['Create the backlog "Ready to start"', "Match all of:", "Mark is Ready", "Step is To do"]);
  });
});

describe("the confirmation card on the page", () => {
  const show = () =>
    render(
      <MemoryRouter initialEntries={["/a/farmers/chat/assistant"]}>
        <Routes>
          <Route path={routes.assistant.pattern} element={<AssistantPage client={mcpAssistantClient} />} />
        </Routes>
      </MemoryRouter>,
    );

  const ask = async () => {
    mcp.listTools.mockResolvedValue(offeredNames.map(tool));
    modelWanting(move);
    show();
    await userEvent.type(await screen.findByRole("textbox"), "move 4 to Doing");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    return screen.findByText("Move issue t4 to step Doing of backlog b1");
  };

  it("shows the change and sends nothing before the person taps", async () => {
    await ask();
    expect(screen.getByRole("button", { name: "Move" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(writesSent()).toHaveLength(0);
  });

  it("sends the move once when the person taps Move", async () => {
    await ask();
    await userEvent.click(screen.getByRole("button", { name: "Move" }));
    await screen.findByText(/"ok":true/);
    expect(writesSent()).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Move" })).toBeNull();
  });

  it("sends nothing when the person taps Cancel", async () => {
    await ask();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await screen.findByText(cancelledResult);
    expect(writesSent()).toHaveLength(0);
  });
});
