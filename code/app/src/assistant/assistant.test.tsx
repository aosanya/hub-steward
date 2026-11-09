import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../agency/open";
import { routes } from "../routes";
import { AssistantPage, failedWords, unavailableWords } from "./AssistantPage";
import { askAssistant, mcpAssistantClient, offeredNames, type AssistantClient } from "./api";

const mcp = vi.hoisted(() => ({ callTool: vi.fn(), listTools: vi.fn() }));

vi.mock("../wakala/mcp", () => ({ callTool: mcp.callTool, listTools: mcp.listTools, McpError: class extends Error {} }));

beforeEach(() => {
  openAgency("farmers");
  mcp.callTool.mockReset();
  mcp.listTools.mockReset();
});

afterEach(() => forgetOpenAgency());

const show = (client: AssistantClient, timeoutMs?: number) =>
  render(
    <MemoryRouter initialEntries={["/a/farmers/chat/assistant"]}>
      <Routes>
        <Route path="/a/:agencyId/chat" element={<p>the chat list</p>} />
        <Route path={routes.assistant.pattern} element={<AssistantPage client={client} timeoutMs={timeoutMs} />} />
      </Routes>
    </MemoryRouter>,
  );

const tool = (name: string) => ({ name, description: `${name} reads`, inputSchema: { type: "object", properties: { instance_id: { type: "string" }, tag: { type: "string" } }, required: ["instance_id"] } });

describe("the assistant page", () => {
  it("says the assistant is not available yet in an empty card, with no writing box, when no model is ready", async () => {
    show({ model: async () => "", ask: vi.fn() });
    const words = await screen.findByText(unavailableWords);
    expect(words.closest(".card")).toHaveClass("empty");
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("says the same when the models cannot be read", async () => {
    show({ model: async () => Promise.reject(new Error("down")), ask: vi.fn() });
    expect(await screen.findByText(unavailableWords)).toBeInTheDocument();
  });

  it("sends what is written with the whole conversation and shows the answer as the assistant's, rendered", async () => {
    const ask = vi.fn().mockResolvedValue({ text: "**3** issues are Blocked", lists: [] });
    show({ model: async () => "acc1", ask });
    await userEvent.type(await screen.findByRole("textbox", { name: "Ask about the backlogs" }), "show the blocked ones");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(ask).toHaveBeenCalledWith("acc1", [{ role: "user", content: "show the blocked ones" }], expect.any(Function));
    const answer = await screen.findByText("3");
    expect(answer.tagName).toBe("STRONG");
    expect(within(screen.getByRole("main")).getByText("Hub Steward")).toBeInTheDocument();
    expect(screen.getByRole("banner")).toHaveTextContent("‹ Chat");
  });

  it("says it could not answer when the model fails, and keeps the writing box", async () => {
    show({ model: async () => "acc1", ask: vi.fn().mockRejectedValue(new Error("down")) });
    await userEvent.type(await screen.findByRole("textbox"), "find the open issues");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText(failedWords)).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });
});

const later = () => {
  let resolve: (answer: { text: string; lists: [] }) => void = () => undefined;
  let reject: (failure: Error) => void = () => undefined;
  const promise = new Promise<{ text: string; lists: [] }>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};

const write = async (words: string) => {
  const box = await screen.findByRole("textbox");
  await userEvent.type(box, words);
  await userEvent.click(screen.getByRole("button", { name: "Send" }));
  return box as HTMLInputElement;
};

describe("while the assistant works", () => {
  it("shows three dots and Looking it up in the assistant's place, names the tool step, then replaces them with the answer", async () => {
    const pending = later();
    let step: (words: string) => void = () => undefined;
    const ask = vi.fn().mockImplementation((_a: string, _t: unknown, onStep: (words: string) => void) => {
      step = onStep;
      return pending.promise;
    });
    show({ model: async () => "acc1", ask });
    await write("which are pending?");
    const working = await screen.findByRole("status");
    expect(working).toHaveTextContent("Looking it up");
    expect(working.querySelectorAll(".assistant-dots i")).toHaveLength(3);
    act(() => step("Searching the issues"));
    expect(working).toHaveTextContent("Searching the issues");
    await act(async () => pending.resolve({ text: "4 are pending", lists: [] }));
    expect(await screen.findByText("4 are pending")).toBeInTheDocument();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("clears the writing box at once, keeps the cursor in it and leaves the send button enabled", async () => {
    const pending = later();
    show({ model: async () => "acc1", ask: vi.fn().mockReturnValue(pending.promise) });
    const box = await write("first");
    expect(box).toHaveValue("");
    expect(box).toHaveFocus();
    await userEvent.type(box, "second");
    expect(screen.getByRole("button", { name: "Send" })).toBeEnabled();
  });

  it("says That did not work with a Try again button when the model fails, and asks again from the button", async () => {
    const ask = vi.fn().mockRejectedValueOnce(new Error("down")).mockResolvedValueOnce({ text: "now it works", lists: [] });
    show({ model: async () => "acc1", ask });
    await write("list them");
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("That did not work. Try again.");
    await userEvent.click(within(alert).getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("now it works")).toBeInTheDocument();
    expect(ask).toHaveBeenCalledTimes(2);
    expect(ask.mock.calls[1][1]).toEqual(ask.mock.calls[0][1]);
  });

  it("gives up with the same message when no answer comes in time", async () => {
    show({ model: async () => "acc1", ask: vi.fn().mockReturnValue(new Promise(() => undefined)) }, 30);
    await write("never answered");
    expect(await screen.findByRole("alert")).toHaveTextContent("That did not work. Try again.");
  });
});

describe("messages written while an answer is pending", () => {
  it("are queued at once, marked Queued, sent one by one in order with the conversation so far, and lose the mark when sent", async () => {
    const first = later();
    const second = later();
    const third = later();
    const answers = [first, second, third];
    const ask = vi.fn().mockImplementation(() => (answers.shift() as ReturnType<typeof later>).promise);
    show({ model: async () => "acc1", ask });
    const box = await write("one");
    await userEvent.type(box, "two");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    await userEvent.type(box, "three");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(box).toHaveValue("");
    expect(screen.getAllByText("Queued")).toHaveLength(2);
    expect(screen.getByText("two").closest(".rm-msg")).toHaveTextContent("Queued");
    expect(screen.getByText("one").closest(".rm-msg")).not.toHaveTextContent("Queued");
    expect(ask).toHaveBeenCalledTimes(1);
    await act(async () => first.resolve({ text: "answer one", lists: [] }));
    await screen.findByText("answer one");
    await waitFor(() => expect(ask).toHaveBeenCalledTimes(2));
    expect(screen.getAllByText("Queued")).toHaveLength(1);
    expect(ask.mock.calls[1][1]).toEqual([
      { role: "user", content: "one" },
      { role: "assistant", content: "answer one" },
      { role: "user", content: "two" },
    ]);
    await act(async () => second.resolve({ text: "answer two", lists: [] }));
    await waitFor(() => expect(ask).toHaveBeenCalledTimes(3));
    expect(screen.queryByText("Queued")).toBeNull();
    expect(ask.mock.calls[2][1].map((turn: { content: string }) => turn.content)).toEqual(["one", "answer one", "two", "answer two", "three"]);
    await act(async () => third.resolve({ text: "answer three", lists: [] }));
    const order = (await screen.findAllByText(/^(one|two|three|answer one|answer two|answer three)$/)).map((node) => node.textContent);
    expect(order).toEqual(["one", "answer one", "two", "answer two", "three", "answer three"]);
  });

  it("can be removed from the queue before they are sent", async () => {
    const first = later();
    const ask = vi.fn().mockReturnValue(first.promise);
    show({ model: async () => "acc1", ask });
    const box = await write("one");
    await userEvent.type(box, "two");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    await userEvent.click(screen.getByRole("button", { name: "Remove from the queue: two" }));
    expect(screen.queryByText("two")).toBeNull();
    await act(async () => first.resolve({ text: "answer one", lists: [] }));
    await screen.findByText("answer one");
    expect(ask).toHaveBeenCalledTimes(1);
  });

  it("pause when a request fails, and go on from the Try again button with the rest still queued", async () => {
    const ask = vi.fn().mockRejectedValueOnce(new Error("down")).mockResolvedValue({ text: "fine", lists: [] });
    const first = later();
    ask.mockReset();
    ask.mockReturnValueOnce(first.promise).mockResolvedValue({ text: "fine", lists: [] });
    show({ model: async () => "acc1", ask });
    const box = await write("one");
    await userEvent.type(box, "two");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    await act(async () => first.reject(new Error("down")));
    const alert = await screen.findByRole("alert");
    expect(screen.getByText("two").closest(".rm-msg")).toHaveTextContent("Queued");
    expect(ask).toHaveBeenCalledTimes(1);
    const retry = within(alert).getByRole("button", { name: "Try again" });
    await act(async () => retry.click());
    await waitFor(() => expect(ask).toHaveBeenCalledTimes(3));
    expect(screen.queryByText("Queued")).toBeNull();
  });
});

describe("the conversation panel", () => {
  it("is one card between the bar and the writing box, with one muted line and nothing else while it is empty", async () => {
    show({ model: async () => "acc1", ask: vi.fn() });
    const line = await screen.findByText("Ask about the backlogs", { selector: "p" });
    const panel = line.closest(".assistant-panel") as HTMLElement;
    expect(panel).not.toBeNull();
    const card = line.closest(".card") as HTMLElement;
    expect(card).not.toBeNull();
    expect(card.querySelectorAll("button, a")).toHaveLength(0);
    expect(card.textContent).toBe("Ask about the backlogs");
    expect(within(panel).getAllByRole("button").map((button) => button.textContent)).toEqual(["Chat", "Results"]);
    expect(screen.getByRole("textbox").closest(".assistant-compose")).not.toBeNull();
  });

  it("puts her messages in the right-hand bubbles and the assistant's in the left-hand ones", async () => {
    const ask = vi.fn().mockResolvedValue({ text: "1 issue is Blocked", lists: [] });
    show({ model: async () => "acc1", ask });
    await userEvent.type(await screen.findByRole("textbox"), "show the blocked ones");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    const mine = (await screen.findByText("show the blocked ones")).closest(".rm-msg");
    expect(mine).toHaveClass("mine");
    const theirs = (await screen.findByText("1 issue is Blocked")).closest(".rm-msg") as HTMLElement;
    expect(theirs).not.toHaveClass("mine");
    expect(screen.queryByText("Ask about the backlogs", { selector: "p" })).toBeNull();
  });

  it("scrolls the newest message into view inside the panel as the conversation grows", async () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    show({ model: async () => "acc1", ask: vi.fn().mockResolvedValue({ text: "ok", lists: [] }) });
    const box = await screen.findByRole("textbox");
    for (const word of ["one", "two", "three"]) {
      await userEvent.type(box, word);
      await userEvent.click(screen.getByRole("button", { name: "Send" }));
      await screen.findAllByText("ok");
    }
    expect(scroll).toHaveBeenCalledWith({ block: "end" });
    expect(screen.getAllByText("ok")).toHaveLength(3);
    expect(document.querySelector(".assistant-panel")?.querySelectorAll(".rm-msg")).toHaveLength(6);
    delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
  });
});

describe("how the assistant answers through the tools", () => {
  it("picks the chat model the hub marked, or the first", async () => {
    mcp.callTool.mockResolvedValueOnce({ items: [{ id: "a", picked: false }, { id: "b", picked: true }] });
    expect(await mcpAssistantClient.model()).toBe("b");
    mcp.callTool.mockResolvedValueOnce({ items: [{ id: "a" }] });
    expect(await mcpAssistantClient.model()).toBe("a");
    mcp.callTool.mockResolvedValueOnce({ items: [] });
    expect(await mcpAssistantClient.model()).toBe("");
  });

  it("runs the list tool the model asks for and sends its result back before answering", async () => {
    mcp.listTools.mockResolvedValue([...offeredNames, "taskmanager_task_delete"].map(tool));
    mcp.callTool.mockImplementation(async (_hub: string, name: string, args: Record<string, unknown>) => {
      if (name === "ai_chat_account") {
        const sent = args.messages as { role: string }[];
        return sent.some((message) => message.role === "tool")
          ? { message: { content: "1 issue is Blocked: DEV-009 Create the structure tables" } }
          : { message: { content: "", tool_calls: [{ id: "c1", name: "taskmanager_task_list", arguments: { tag: "Blocked" } }] } };
      }
      return { items: [{ title: "DEV-009 Create the structure tables", tags: ["Blocked"] }] };
    });
    const answer = await askAssistant("acc1", [{ role: "user", content: "show the blocked ones" }]);
    expect(answer.text).toBe("1 issue is Blocked: DEV-009 Create the structure tables");
    expect(answer.lists).toHaveLength(1);
    expect(answer.lists[0]).toMatchObject({ title: "Blocked issues", total: 1 });
    expect(answer.lists[0].issues.map((issue) => issue.title)).toEqual(["DEV-009 Create the structure tables"]);
    expect(answer.lists[0].issues[0].mark).toBe("Blocked");
    expect(mcp.callTool).toHaveBeenCalledWith("", "taskmanager_task_list", { tag: "Blocked" });
    const chats = mcp.callTool.mock.calls.filter((call) => call[1] === "ai_chat_account");
    expect(chats).toHaveLength(2);
    const second = chats[1][2].messages;
    expect(second[second.length - 1]).toMatchObject({ role: "tool", tool_call_id: "c1" });
    expect(second[second.length - 1].content).toContain("DEV-009");
    expect(chats[0][2].accountID).toBe("acc1");
  });

  it("offers only the reading task tools, without the hub id argument", async () => {
    mcp.listTools.mockResolvedValue([...offeredNames, "taskmanager_task_delete", "taskmanager_task_create"].map(tool));
    mcp.callTool.mockResolvedValue({ message: { content: "ok" } });
    await askAssistant("acc1", [{ role: "user", content: "hi" }]);
    const sent = mcp.callTool.mock.calls[0][2];
    expect(sent.tools.map((spec: { name: string }) => spec.name)).toEqual(offeredNames);
    expect(Object.keys(sent.tools[0].parameters.properties)).toEqual(["tag"]);
    expect(sent.tools[0].parameters.required).toEqual([]);
  });

  it("refuses a tool it was not offered and tells the model so", async () => {
    mcp.listTools.mockResolvedValue(offeredNames.map(tool));
    mcp.callTool.mockImplementation(async (_hub: string, name: string, args: Record<string, unknown>) => {
      if (name !== "ai_chat_account") throw new Error("must not be called");
      const sent = args.messages as { role: string }[];
      return sent.some((message) => message.role === "tool")
        ? { message: { content: "I cannot do that." } }
        : { message: { content: "", tool_calls: [{ id: "c1", name: "taskmanager_task_delete", arguments: { id: "x" } }] } };
    });
    expect((await askAssistant("acc1", [{ role: "user", content: "delete everything" }])).text).toBe("I cannot do that.");
    expect(mcp.callTool.mock.calls.some((call) => call[1] === "taskmanager_task_delete")).toBe(false);
  });

  it("passes a failed tool call back to the model instead of failing", async () => {
    mcp.listTools.mockResolvedValue(offeredNames.map(tool));
    mcp.callTool.mockImplementation(async (_hub: string, name: string, args: Record<string, unknown>) => {
      if (name === "ai_chat_account") {
        const sent = args.messages as { role: string; content: string }[];
        const toolReply = sent.find((message) => message.role === "tool");
        return toolReply ? { message: { content: toolReply.content } } : { message: { content: "", tool_calls: [{ id: "c1", name: "taskmanager_task_list", arguments: {} }] } };
      }
      throw new Error("forbidden");
    });
    expect((await askAssistant("acc1", [{ role: "user", content: "list" }])).text).toBe("The call failed: forbidden");
  });

  it("stops after a few rounds when the model only keeps asking for tools", async () => {
    mcp.listTools.mockResolvedValue(offeredNames.map(tool));
    mcp.callTool.mockImplementation(async (_hub: string, name: string) =>
      name === "ai_chat_account" ? { message: { content: "", tool_calls: [{ id: "c", name: "taskmanager_task_list", arguments: {} }] } } : { items: [] },
    );
    expect((await askAssistant("acc1", [{ role: "user", content: "list" }])).text).toMatch(/narrower question/);
    expect(mcp.callTool.mock.calls.filter((call) => call[1] === "ai_chat_account")).toHaveLength(6);
  });

  it("fails when the model sends neither words nor a tool call", async () => {
    mcp.listTools.mockResolvedValue([]);
    mcp.callTool.mockResolvedValue({ message: { content: "" } });
    await expect(askAssistant("acc1", [{ role: "user", content: "hi" }])).rejects.toThrow("sent no answer");
  });
});
