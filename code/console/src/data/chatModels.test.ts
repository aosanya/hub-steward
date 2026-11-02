import { beforeEach, describe, expect, it, vi } from "vitest";
import { callTool } from "../wakala/mcp";
import { keepChatModelPick, pickedChatModel } from "./chatModels";

vi.mock("../wakala/mcp", async (importOriginal) => ({ ...(await importOriginal<object>()), callTool: vi.fn() }));

const callToolMock = vi.mocked(callTool);

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<unknown[]>((done) => {
    resolve = () => done([]);
  });
  return { promise, resolve };
};

const settle = () => new Promise<void>((done) => setTimeout(done, 0));

beforeEach(() => {
  callToolMock.mockReset();
});

describe("the chat model the person picked", () => {
  it("is the one ai_list_chat_models marks picked, read from a list or from items", async () => {
    const models = [
      { id: "a1", label: "GLM 4.6", picked: false },
      { id: "a2", label: "Qwen 3", picked: true },
    ];
    callToolMock.mockResolvedValueOnce(models).mockResolvedValueOnce({ items: models });

    expect(await pickedChatModel("siaya")).toBe("a2");
    expect(await pickedChatModel("siaya")).toBe("a2");
    expect(callToolMock).toHaveBeenCalledWith("siaya", "ai_list_chat_models");
  });

  it("is nothing when the hub has no chat model or the tool refuses", async () => {
    callToolMock.mockResolvedValueOnce({ items: [] }).mockRejectedValueOnce(new Error("ai_list_chat_models: not allowed"));

    expect(await pickedChatModel("siaya")).toBe("");
    expect(await pickedChatModel("siaya")).toBe("");
  });
});

describe("keeping the pick for the person", () => {
  it("sends the account to ai_pick_chat_model and says it was kept", async () => {
    callToolMock.mockResolvedValue([]);

    expect(await keepChatModelPick("siaya", "a2")).toBe(true);

    expect(callToolMock).toHaveBeenCalledWith("siaya", "ai_pick_chat_model", { account_id: "a2" });
  });

  it("does not fail the chat when the pick cannot be kept, and says it was not", async () => {
    callToolMock.mockRejectedValue(new Error("ai_pick_chat_model: the model is not available"));

    expect(await keepChatModelPick("siaya", "a2")).toBe(false);
  });

  it("sends the picks of one hub in the order they were made, each after the one before was answered", async () => {
    const slow = deferred();
    const reached: unknown[] = [];
    callToolMock.mockImplementation((async (_hub: string, _tool: string, args: { account_id: string }) => {
      reached.push(args.account_id);
      return args.account_id === "a1" ? slow.promise : [];
    }) as typeof callTool);

    const first = keepChatModelPick("siaya", "a1");
    const second = keepChatModelPick("siaya", "a2");
    await settle();

    expect(reached).toEqual(["a1"]);
    slow.resolve();
    expect(await Promise.all([first, second])).toEqual([true, true]);
    expect(reached).toEqual(["a1", "a2"]);
  });

  it("sends the next pick although the one before was refused, and tells them apart", async () => {
    callToolMock.mockRejectedValueOnce(new Error("ai_pick_chat_model: down")).mockResolvedValueOnce([]);

    const first = keepChatModelPick("siaya", "a1");
    const second = keepChatModelPick("siaya", "a2");

    expect([await first, await second]).toEqual([false, true]);
    expect(callToolMock.mock.calls.map((call) => call[2])).toEqual([{ account_id: "a1" }, { account_id: "a2" }]);
  });

  it("does not hold the pick of one hub back for the pick of another", async () => {
    const slow = deferred();
    callToolMock.mockImplementation((async (hub: string) => (hub === "siaya" ? slow.promise : [])) as typeof callTool);

    keepChatModelPick("siaya", "a1");
    const other = keepChatModelPick("kisumu", "b1");
    await settle();

    expect(await other).toBe(true);
    slow.resolve();
  });
});
