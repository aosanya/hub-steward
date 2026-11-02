import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import words from "../../public/i18n.json";
import type { ActionAnswer } from "../data/chatAnswer";
import { askModel, chatTool, type Turn } from "../data/modelChat";
import { showRoleLimitFormTool } from "../data/roleLimitAction";
import { I18nProvider } from "../i18n";
import type { Hub } from "../types";
import { callTool, listTools, type ToolInfo } from "../wakala/mcp";
import { ActionSlot } from "./ActionSlot";
import { ConsoleCtx } from "./context";

vi.mock("../wakala/mcp", async (importOriginal) => ({ ...(await importOriginal<object>()), callTool: vi.fn(), listTools: vi.fn() }));

const callToolMock = vi.mocked(callTool);
const listToolsMock = vi.mocked(listTools);

const hub: Hub = { id: "h1", name: "Siaya Farmers' Group", role: "owner", kind: "farmers" };

const farmers = { id: "r1", name: "Farmers' agent", account_id: "c1", tokens_per_day: 100000, tokens_per_call: 8000 };

const suppliers = { id: "r2", name: "Suppliers' agent", account_id: "c1", tokens_per_day: 40000 };

const readTool = (name: string): ToolInfo => ({ name, description: `about ${name}`, inputSchema: { type: "object", properties: {}, required: [] } });

const setRoleLimits: ToolInfo = {
  name: "ai_set_role_limits",
  description: "Set AI role limits",
  inputSchema: {
    type: "object",
    properties: { roleID: { type: "string" }, tokens_per_day: { type: ["integer", "null"] } },
    required: ["roleID"],
  },
};

const asks = (name: string, args: unknown) => ({ message: { role: "assistant", content: "", tool_calls: [{ id: "t1", name, arguments: args }] } });

const said = (content: string) => ({ message: { role: "assistant", content } });

const turns: Turn[] = [{ role: "user", content: "Raise the Farmers' agent to 150,000 tokens a day" }];

const chatAnswers = (answers: unknown[]) => {
  const queue = [...answers];
  callToolMock.mockImplementation((async (_hub: string, name: string) => {
    if (name === chatTool) return queue.length > 1 ? queue.shift() : queue[0];
    if (name === "ai_list_roles") return { items: [farmers, suppliers] };
    if (name === "ai_get_role") return farmers;
    return { items: [] };
  }) as typeof callTool);
};

const offeredNames = () => ((callToolMock.mock.calls[0][2] as { tools?: { name: string }[] }).tools ?? []).map((spec) => spec.name);

const drawn = (answer: ActionAnswer) =>
  render(
    <I18nProvider initial={words}>
      <ConsoleCtx.Provider value={{ hub, page: "models", setBadges: () => {}, refreshMenu: () => {} }}>
        <ActionSlot hubId={hub.id} answer={answer} onClear={() => {}} />
      </ConsoleCtx.Provider>
    </I18nProvider>,
  );

beforeEach(() => {
  callToolMock.mockReset();
  listToolsMock.mockReset();
  listToolsMock.mockResolvedValue([readTool("ai_list_roles"), readTool("ai_get_role"), setRoleLimits, readTool(chatTool)]);
});

describe("asking the chat on the Models page about a role's limit", () => {
  it("offers the role-limit tool to the model on the Models page and on no other", async () => {
    chatAnswers([said("ok")]);
    await askModel(hub.id, "a1", turns, "models");
    expect(offeredNames()).toContain(showRoleLimitFormTool);

    callToolMock.mockClear();
    chatAnswers([said("ok")]);
    await askModel(hub.id, "a1", turns, "status");
    expect(offeredNames()).not.toContain(showRoleLimitFormTool);
  });

  it("lands the form for the role and limit it named as the answer, and opens it in the content area", async () => {
    chatAnswers([asks(showRoleLimitFormTool, { role: "r1", limit: "tokens_per_day", value: 150000 }), said("Check it, then press Save.")]);

    const reply = await askModel(hub.id, "a1", turns, "models");

    expect(reply.answer).toEqual({
      kind: "action",
      prompt: turns[0].content,
      view: "roleLimit",
      title: "",
      params: { role: "r1", limit: "tokens_per_day", value: 150000 },
    });
    drawn(reply.answer as ActionAnswer);
    expect(await screen.findByRole("combobox")).toHaveValue("r1");
    expect(screen.getByRole("spinbutton")).toHaveValue(150000);
    expect(callToolMock.mock.calls.filter((call) => call[1] === "ai_set_role_limits")).toEqual([]);
  });
});
