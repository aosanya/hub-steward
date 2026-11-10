import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../agency/open";
import { routes } from "../routes";
import { AssistantPage, failedWords } from "./AssistantPage";
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

const writesSent = () => mcp.callTool.mock.calls.filter((call) => call[1] === rulesTool);

describe("a write the hub refuses after the person confirmed it", () => {
  const confirmTheChange = async () => {
    render(
      <MemoryRouter initialEntries={["/a/farmers/chat/assistant"]}>
        <Routes>
          <Route path={routes.assistant.pattern} element={<AssistantPage client={mcpAssistantClient} />} />
        </Routes>
      </MemoryRouter>,
    );
    await userEvent.type(await screen.findByRole("textbox"), "change ready to the last 14 days");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    await userEvent.click(await screen.findByRole("button", { name: "Change the rules" }));
  };

  it("ends the card and says the change failed, with the hub's reason and a way to ask again", async () => {
    await confirmTheChange();
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(failedWords);
    expect(alert).toHaveTextContent('the hub is not reachable');
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("leaves no confirm button live, asks the model once and sends the write once", async () => {
    await confirmTheChange();
    await screen.findByRole("alert");
    expect(screen.queryByRole("button", { name: "Change the rules" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
    expect(mcp.callTool.mock.calls.filter((call) => call[1] === "ai_chat_account")).toHaveLength(1);
    expect(writesSent()).toHaveLength(1);
  });
});
