import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { forgetOpenAgency, openAgency } from "../agency/open";
import { dayLimitWords, failedWords, monthLimitWords } from "./AssistantPage";
import { askAssistant, LimitReached, type AssistantClient } from "./api";
import { say, showAssistant } from "./assistantScreen";
import { forgetConversations } from "./session";

const mcp = vi.hoisted(() => ({ callTool: vi.fn(), listTools: vi.fn() }));

vi.mock("../wakala/mcp", () => ({ callTool: mcp.callTool, listTools: mcp.listTools, McpError: class extends Error {} }));

beforeEach(() => {
  openAgency("farmers");
  mcp.callTool.mockReset();
  mcp.listTools.mockReset();
});

afterEach(() => {
  forgetOpenAgency();
  forgetConversations();
});

const show = (ask: AssistantClient["ask"]) => showAssistant({ ask });

describe("the model refuses because the person's share is used", () => {
  it("raises the day limit when the chat call is refused with the day sentence", async () => {
    mcp.listTools.mockResolvedValue([]);
    mcp.callTool.mockRejectedValue(new Error("assistant limit: day. You have used today's share."));
    await expect(askAssistant("acc1", [{ role: "user", content: "hi" }])).rejects.toMatchObject({ span: "day" });
  });

  it("raises the month limit when the chat call is refused with the month sentence", async () => {
    mcp.listTools.mockResolvedValue([]);
    mcp.callTool.mockRejectedValue(new Error("ai: assistant limit: month. You have used this month's share."));
    await expect(askAssistant("acc1", [{ role: "user", content: "hi" }])).rejects.toBeInstanceOf(LimitReached);
  });

  it("leaves any other refusal as it was", async () => {
    mcp.listTools.mockResolvedValue([]);
    mcp.callTool.mockRejectedValue(new Error("account limit: tokens per day"));
    await expect(askAssistant("acc1", [{ role: "user", content: "hi" }])).rejects.not.toBeInstanceOf(LimitReached);
  });
});

describe("the assistant page at the limit", () => {
  it("shows the day sentence in an empty card, keeps the conversation, hides the writing box and asks nothing more", async () => {
    const ask = vi.fn().mockRejectedValue(new LimitReached("day"));
    show(ask);
    await say("how many are blocked");
    expect(await screen.findByText(dayLimitWords)).toBeInTheDocument();
    expect(screen.getByText(dayLimitWords).closest(".card")).toHaveClass("empty");
    expect(screen.getByText("how many are blocked")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText(failedWords)).toBeNull();
    expect(ask).toHaveBeenCalledTimes(1);
  });

  it("shows the month sentence for the month", async () => {
    show(vi.fn().mockRejectedValue(new LimitReached("month")));
    await say("what is pending");
    expect(await screen.findByText(monthLimitWords)).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("drops a message that was queued behind the refused one and does not send it", async () => {
    let refuse: (failure: Error) => void = () => undefined;
    const first = new Promise<never>((_, no) => {
      refuse = no;
    });
    const ask = vi.fn().mockReturnValueOnce(first).mockResolvedValue({ text: "late", lists: [] });
    show(ask);
    await say("one");
    await userEvent.type(screen.getByRole("textbox", { name: "Ask about the backlogs" }), "two");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(screen.getByText("two").closest(".rm-msg")).toHaveTextContent("Queued");
    await act(async () => refuse(new LimitReached("day")));
    expect(await screen.findByText(dayLimitWords)).toBeInTheDocument();
    expect(screen.queryByText("two")).toBeNull();
    expect(screen.queryByText("Queued")).toBeNull();
    expect(ask).toHaveBeenCalledTimes(1);
  });

  it("still shows the failure card and the writing box for an ordinary failure", async () => {
    show(vi.fn().mockRejectedValue(new Error("down")));
    await say("hello");
    expect(await screen.findByRole("alert")).toHaveTextContent(failedWords);
    expect(screen.getByRole("textbox", { name: "Ask about the backlogs" })).toBeInTheDocument();
    expect(screen.queryByText(dayLimitWords)).toBeNull();
  });
});
