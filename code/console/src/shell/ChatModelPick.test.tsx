import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listAccounts, type Account } from "../data/accounts";
import { askModel } from "../data/modelChat";
import { I18nProvider } from "../i18n";
import { callTool } from "../wakala/mcp";
import { ChatColumn } from "./ChatColumn";
import { chatModelKeptKey, chatModelKey } from "./useChatModels";

vi.mock("../data/accounts", async (importOriginal) => ({ ...(await importOriginal<object>()), listAccounts: vi.fn() }));

vi.mock("../data/modelChat", () => ({ askModel: vi.fn() }));

vi.mock("../wakala/mcp", async (importOriginal) => ({ ...(await importOriginal<object>()), callTool: vi.fn() }));

const words = JSON.parse(readFileSync(resolve(__dirname, "../../public/i18n.json"), "utf8"));

const listAccountsMock = vi.mocked(listAccounts);
const askModelMock = vi.mocked(askModel);
const callToolMock = vi.mocked(callTool);

const account = (id: string, chatLabel: string): Account => ({
  id,
  name: `account ${id}`,
  provider: "openai",
  baseUrl: "https://models.test/v1",
  modelName: `model-${id}`,
  status: "enabled",
  keySet: true,
  lastTestResult: "working",
  lastTestedAt: "",
  lastTestPrompt: "",
  lastTestReply: "",
  lastTestMs: null,
  chatEnabled: true,
  chatLabel,
});

const serverList = (pickedId: string) => [
  { id: "a1", label: "GLM 4.6", picked: pickedId === "a1" },
  { id: "a2", label: "Qwen 3", picked: pickedId === "a2" },
];

const serverAnswers = (pickedId: string) =>
  callToolMock.mockImplementation((async (_hub: string, tool: string) => (tool === "ai_list_chat_models" ? serverList(pickedId) : [])) as typeof callTool);

const openChat = () =>
  render(
    <I18nProvider initial={words}>
      <ChatColumn hubId="siaya" page="status" rail={false} onToggleRail={() => {}} />
    </I18nProvider>,
  );

const chip = (name: string) => screen.findByRole("button", { name });

const pickCalls = () => callToolMock.mock.calls.filter(([, tool]) => tool === "ai_pick_chat_model");

beforeEach(() => {
  localStorage.clear();
  callToolMock.mockReset();
  listAccountsMock.mockReset();
  askModelMock.mockReset();
  askModelMock.mockResolvedValue({ text: "An answer.", calls: [] });
  listAccountsMock.mockResolvedValue([account("a1", "GLM 4.6"), account("a2", "Qwen 3")]);
});

describe("the chat box model pick kept for the person", () => {
  it("opens on the model this browser kept when the server's pick is only its first model", async () => {
    localStorage.setItem(chatModelKey("siaya"), "a2");
    serverAnswers("a1");
    openChat();

    expect(await chip("Qwen 3")).toBeInTheDocument();
  });

  it("opens on the model picked on the server when the server last kept this browser's pick", async () => {
    localStorage.setItem(chatModelKey("siaya"), "a1");
    localStorage.setItem(chatModelKeptKey("siaya"), "a1");
    serverAnswers("a2");
    openChat();

    expect(await chip("Qwen 3")).toBeInTheDocument();
  });

  it("opens on the model this browser picked after the one the server last kept", async () => {
    localStorage.setItem(chatModelKey("siaya"), "a2");
    localStorage.setItem(chatModelKeptKey("siaya"), "a1");
    serverAnswers("a1");
    openChat();

    expect(await chip("Qwen 3")).toBeInTheDocument();
  });

  it("answers with the model picked on the server", async () => {
    const user = userEvent.setup();
    serverAnswers("a2");
    openChat();
    await chip("Qwen 3");

    await user.type(screen.getByRole("textbox", { name: "Write a message" }), "hi{Enter}");

    await waitFor(() => expect(askModelMock).toHaveBeenCalled());
    expect(askModelMock).toHaveBeenCalledWith("siaya", "a2", expect.anything(), "status", "", expect.any(AbortSignal));
  });

  it("keeps the pick on the server when a model is picked", async () => {
    const user = userEvent.setup();
    serverAnswers("a1");
    openChat();

    await user.click(await chip("GLM 4.6"));
    await user.click(within(screen.getByRole("listbox", { name: "Model" })).getByRole("option", { name: "Qwen 3" }));

    expect(await chip("Qwen 3")).toBeInTheDocument();
    await waitFor(() => expect(pickCalls()).toEqual([["siaya", "ai_pick_chat_model", { account_id: "a2" }]]));
  });

  it("goes on with the pick this browser kept when the server cannot say", async () => {
    localStorage.setItem(chatModelKey("siaya"), "a2");
    callToolMock.mockRejectedValue(new Error("ai_list_chat_models: not allowed"));
    openChat();

    expect(await chip("Qwen 3")).toBeInTheDocument();
  });

  it("keeps the chosen model in the chat when the server cannot keep the pick", async () => {
    const user = userEvent.setup();
    callToolMock.mockRejectedValue(new Error("ai_pick_chat_model: the model is not available"));
    openChat();

    await user.click(await chip("GLM 4.6"));
    await user.click(within(screen.getByRole("listbox", { name: "Model" })).getByRole("option", { name: "Qwen 3" }));

    expect(await chip("Qwen 3")).toBeInTheDocument();
    expect(localStorage.getItem(chatModelKey("siaya"))).toBe("a2");
    expect(localStorage.getItem(chatModelKeptKey("siaya"))).toBeNull();
  });

  it("opens on the model picked here after the server refused to keep it, though the server lists its first model as picked", async () => {
    const user = userEvent.setup();
    callToolMock.mockImplementation((async (_hub: string, tool: string) => {
      if (tool === "ai_pick_chat_model") throw new Error("ai_pick_chat_model: down");
      return tool === "ai_list_chat_models" ? serverList("a1") : [];
    }) as typeof callTool);
    const first = openChat();
    await user.click(await chip("GLM 4.6"));
    await user.click(within(screen.getByRole("listbox", { name: "Model" })).getByRole("option", { name: "Qwen 3" }));
    await chip("Qwen 3");
    await waitFor(() => expect(pickCalls()).toHaveLength(1));
    first.unmount();

    openChat();

    expect(await chip("Qwen 3")).toBeInTheDocument();
  });

  it("follows a pick made elsewhere once the server has kept this browser's", async () => {
    const user = userEvent.setup();
    serverAnswers("a1");
    const first = openChat();
    await user.click(await chip("GLM 4.6"));
    await user.click(within(screen.getByRole("listbox", { name: "Model" })).getByRole("option", { name: "Qwen 3" }));
    await waitFor(() => expect(localStorage.getItem(chatModelKeptKey("siaya"))).toBe("a2"));
    first.unmount();
    serverAnswers("a1");

    openChat();

    expect(await chip("GLM 4.6")).toBeInTheDocument();
  });

  it("ignores a server pick for a model the chat no longer offers", async () => {
    localStorage.setItem(chatModelKey("siaya"), "a2");
    callToolMock.mockImplementation((async (_hub: string, tool: string) => (tool === "ai_list_chat_models" ? [{ id: "gone", label: "Gone", picked: true }] : [])) as typeof callTool);
    openChat();

    expect(await chip("Qwen 3")).toBeInTheDocument();
  });
});
