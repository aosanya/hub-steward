import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import words from "../../public/i18n.json";
import type { ActionAnswer } from "../data/chatAnswer";
import { limitRaiseView, showLimitRaiseTool } from "../data/limitRaise";
import { askModel, chatTool, type Turn } from "../data/modelChat";
import { I18nProvider } from "../i18n";
import type { Hub } from "../types";
import { callTool, listTools, type ToolInfo } from "../wakala/mcp";
import { ActionSlot } from "./ActionSlot";
import { ConsoleCtx } from "./context";

vi.mock("../wakala/mcp", async (importOriginal) => ({ ...(await importOriginal<object>()), callTool: vi.fn(), listTools: vi.fn() }));

const callToolMock = vi.mocked(callTool);
const listToolsMock = vi.mocked(listTools);

const hub: Hub = { id: "h1", name: "Siaya Farmers' Group", role: "owner", kind: "farmers" };

const model = {
  id: "c1",
  name: "Meta Model API",
  tokens_per_call: 8000,
  tokens_per_day: 200000,
  tokens_per_month: 4000000,
};

const readTool = (name: string): ToolInfo => ({ name, description: `about ${name}`, inputSchema: { type: "object", properties: {}, required: [] } });

const asks = (name: string, args: unknown) => ({ message: { role: "assistant", content: "", tool_calls: [{ id: "t1", name, arguments: args }] } });

const said = (content: string) => ({ message: { role: "assistant", content } });

const turns: Turn[] = [{ role: "user", content: "Why did the Farmers' agent stop answering?" }];

const refusal = { limit: "tokens_per_month", owner: "account", id: "c1", max: 4000000, used: 4000000, value: 6000000 };

const chatAnswers = (answers: unknown[]) => {
  const queue = [...answers];
  callToolMock.mockImplementation((async (_hub: string, name: string) => {
    if (name === chatTool) return queue.length > 1 ? queue.shift() : queue[0];
    if (name === "ai_get_account") return model;
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
  listToolsMock.mockResolvedValue([readTool("ai_check_limits"), readTool("ai_get_account"), readTool(chatTool)]);
});

describe("asking the chat on the Models page why a call was refused", () => {
  it("offers the raise tool to the model on the Models page and on no other", async () => {
    chatAnswers([said("ok")]);
    await askModel(hub.id, "a1", turns, "models");
    expect(offeredNames()).toContain(showLimitRaiseTool);

    callToolMock.mockClear();
    chatAnswers([said("ok")]);
    await askModel(hub.id, "a1", turns, "status");
    expect(offeredNames()).not.toContain(showLimitRaiseTool);
  });

  it("lands the raise the model named as the answer, shows it as a card to approve, and records nothing", async () => {
    chatAnswers([asks(showLimitRaiseTool, refusal), said("Check it, then press Approve.")]);

    const reply = await askModel(hub.id, "a1", turns, "models");

    expect(reply.answer).toEqual({ kind: "action", prompt: turns[0].content, view: limitRaiseView, title: "", params: refusal });
    drawn(reply.answer as ActionAnswer);
    expect(await screen.findByText("Raise Tokens per month to 6,000,000")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve" })).toBeInTheDocument();
    expect(callToolMock.mock.calls.filter((call) => call[1] === "ai_set_limits" || call[1] === "ai_set_role_limits")).toEqual([]);
  });
});
