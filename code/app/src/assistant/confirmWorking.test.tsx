import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../agency/open";
import { routes } from "../routes";
import { AssistantPage, workingWords } from "./AssistantPage";
import { mcpAssistantClient, offeredNames } from "./api";
import { rulesTool } from "./confirm";
import { forgetConversations } from "./session";

const mcp = vi.hoisted(() => ({ callTool: vi.fn(), listTools: vi.fn() }));

vi.mock("../wakala/mcp", () => ({ callTool: mcp.callTool, listTools: mcp.listTools, McpError: class extends Error {} }));

const refusal = 'taskmanager_backlog_rules_set: the hub is not reachable';

const rulesCall = { id: "c1", name: rulesTool, arguments: { backlog: "b1", rules: { match: "all", rules: [{ field: "last_changed", operator: "in_the_last", value: "14 days" }] } } };

const tool = (name: string) => ({ name, description: name, inputSchema: { type: "object", properties: { instance_id: { type: "string" } }, required: ["instance_id"] } });

beforeEach(() => {
  openAgency("farmers");
  mcp.callTool.mockReset();
  mcp.listTools.mockReset();
  mcp.listTools.mockResolvedValue(offeredNames.map(tool));
  mcp.callTool.mockImplementation(async (_hub: string, name: string) => {
    if (name === "ai_chat_account") return { message: { content: "", tool_calls: [rulesCall] } };
    if (name === "ai_list_chat_models") return { items: [{ id: "acc1", picked: true }] };
    if (name === "agency_list_publications") return { items: [] };
    if (name === rulesTool) throw new Error(refusal);
    return { ok: true };
  });
});

afterEach(() => {
  forgetOpenAgency();
  forgetConversations();
});

describe("the working card while a confirm card waits for the person", () => {
  it("is gone once the card is up", async () => {
    render(
      <MemoryRouter initialEntries={["/a/farmers/chat/assistant"]}>
        <Routes>
          <Route path={routes.assistant.pattern} element={<AssistantPage client={mcpAssistantClient} />} />
        </Routes>
      </MemoryRouter>,
    );
    await userEvent.type(await screen.findByRole("textbox"), "change ready to the last 14 days");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    await screen.findByRole("button", { name: "Change the rules" });
    expect(screen.queryByText(workingWords)).toBeNull();
  });
});
