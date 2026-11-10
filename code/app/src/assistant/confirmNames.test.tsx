import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { BacklogsClient, Issue } from "../backlogs/api";
import { forgetOpenAgency, openAgency } from "../agency/open";
import { routes } from "../routes";
import { AssistantPage } from "./AssistantPage";
import { mcpAssistantClient, offeredNames } from "./api";
import { moveTool, nameWrite, rulesTool, writeLines } from "./confirm";

const mcp = vi.hoisted(() => ({ callTool: vi.fn(), listTools: vi.fn() }));

vi.mock("../wakala/mcp", () => ({ callTool: mcp.callTool, listTools: mcp.listTools, McpError: class extends Error {} }));

beforeEach(() => {
  openAgency("farmers");
  mcp.callTool.mockReset();
  mcp.listTools.mockReset();
});

afterEach(() => forgetOpenAgency());

const move = { tool: moveTool, arguments: { taskID: "t4", backlog: "b1", step: "Doing" } };

const issueNamed = (title: string): Issue => ({ id: "t4", title, description: "", status: "open", step: "To do", repo: "", topics: [], backlog: "Software", mark: "Ready", rank: 1 });

const clientOf = (overrides: Partial<BacklogsClient> = {}): BacklogsClient => ({
  backlogs: vi.fn().mockResolvedValue([{ id: "b1", name: "Software", steps: ["To do", "Doing"], issues: 3 }]),
  issues: vi.fn().mockResolvedValue([]),
  issue: vi.fn().mockResolvedValue({ ...issueNamed("Fix the drift"), waitsOn: [], waitedOnBy: [] }),
  ...overrides,
});

describe("the names on a confirmation card", () => {
  it("reads the issue and the backlog back by name", () => {
    expect(writeLines(move, { issue: "Fix the drift", backlog: "Software" })).toEqual(['Move "Fix the drift" to step Doing of Software']);
  });

  it("names the backlog whose rules change", () => {
    expect(writeLines({ tool: rulesTool, arguments: { backlogID: "b1", rules: [] } }, { backlog: "Software" })[0]).toBe("Change the rules of Software to:");
  });

  it("takes the title from a list the page holds without reading the issue", async () => {
    const client = clientOf();
    const held = [{ id: "r1", title: "x", total: 1, issues: [issueNamed("Held title")] }];
    expect(await nameWrite(move, held, client)).toEqual({ issue: "Held title", backlog: "Software", step: "Doing" });
    expect(client.issue).not.toHaveBeenCalled();
  });

  it("reads the issue once when no list holds it", async () => {
    const client = clientOf();
    expect(await nameWrite(move, [], client)).toEqual({ issue: "Fix the drift", backlog: "Software", step: "Doing" });
    expect(client.issue).toHaveBeenCalledTimes(1);
  });

  it("falls back to the ids when the reads fail", async () => {
    const client = clientOf({ backlogs: vi.fn().mockRejectedValue(new Error("no")), issue: vi.fn().mockRejectedValue(new Error("no")) });
    expect(await nameWrite(move, [], client)).toEqual({});
    expect(writeLines(move, {})).toEqual(["Move issue t4 to step Doing of backlog b1"]);
  });
});

describe("the card on the page", () => {
  it("shows the names, and the write still waits for the tap", async () => {
    mcp.listTools.mockResolvedValue(offeredNames.map((name) => ({ name, description: name, inputSchema: { type: "object", properties: {}, required: [] } })));
    mcp.callTool.mockImplementation(async (_hub: string, name: string, args: Record<string, unknown>) => {
      if (name === "ai_chat_account") {
        const sent = args.messages as { role: string; content: string }[];
        return sent.some((message) => message.role === "tool") ? { message: { content: "done" } } : { message: { content: "", tool_calls: [{ id: "c1", name: moveTool, arguments: move.arguments }] } };
      }
      if (name === "ai_list_chat_models") return { items: [{ id: "acc1", picked: true }] };
      if (name === "agency_list_publications") return { items: [] };
      return { ok: true };
    });
    render(
      <MemoryRouter initialEntries={["/a/farmers/chat/assistant"]}>
        <Routes>
          <Route path={routes.assistant.pattern} element={<AssistantPage client={mcpAssistantClient} backlogs={clientOf()} />} />
        </Routes>
      </MemoryRouter>,
    );
    await userEvent.type(await screen.findByRole("textbox"), "move 4 to Doing");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText('Move "Fix the drift" to step Doing of Software')).toBeInTheDocument();
    expect(mcp.callTool.mock.calls.filter((call) => call[1] === moveTool)).toHaveLength(0);
  });
});
