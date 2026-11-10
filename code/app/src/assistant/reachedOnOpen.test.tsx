import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../agency/open";
import { routes } from "../routes";
import { AssistantPage, dayLimitWords, monthLimitWords } from "./AssistantPage";
import { mcpAssistantClient, type AssistantClient, type LimitSpan } from "./api";
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

const show = (client: Partial<AssistantClient>) =>
  render(
    <MemoryRouter initialEntries={["/a/farmers/chat/assistant"]}>
      <Routes>
        <Route path={routes.assistant.pattern} element={<AssistantPage client={{ model: async () => "acc1", ask: async () => ({ text: "ok", lists: [] }), ...client }} />} />
        <Route path="*" element={<p>elsewhere</p>} />
      </Routes>
    </MemoryRouter>,
  );

const writingBox = () => screen.queryByRole("textbox", { name: "Ask about the backlogs" });

describe("the assistant page checks the person's own share when it opens", () => {
  it("shows the day sentence at once and hides the writing box when the day share is used", async () => {
    const reached = vi.fn<() => Promise<LimitSpan | "">>().mockResolvedValue("day");
    show({ reached });
    expect(await screen.findByText(dayLimitWords)).toBeInTheDocument();
    expect(screen.getByText(dayLimitWords).closest(".card")).toHaveClass("empty");
    expect(writingBox()).toBeNull();
  });

  it("shows the month sentence when the month share is used", async () => {
    show({ reached: async () => "month" });
    expect(await screen.findByText(monthLimitWords)).toBeInTheDocument();
    expect(writingBox()).toBeNull();
  });

  it("shows no card and keeps the writing box when nothing is reached", async () => {
    const reached = vi.fn<() => Promise<LimitSpan | "">>().mockResolvedValue("");
    show({ reached });
    expect(await screen.findByRole("textbox", { name: "Ask about the backlogs" })).toBeInTheDocument();
    await waitFor(() => expect(reached).toHaveBeenCalled());
    expect(screen.queryByText(dayLimitWords)).toBeNull();
    expect(screen.queryByText(monthLimitWords)).toBeNull();
  });

  it("makes exactly one call when it opens", async () => {
    const reached = vi.fn<() => Promise<LimitSpan | "">>().mockResolvedValue("");
    show({ reached });
    expect(await screen.findByRole("textbox", { name: "Ask about the backlogs" })).toBeInTheDocument();
    await waitFor(() => expect(reached).toHaveBeenCalledTimes(1));
    expect(reached).toHaveBeenCalledTimes(1);
  });

  it("checks again after an answer and shows the card when that answer used the share up", async () => {
    const reached = vi.fn<() => Promise<LimitSpan | "">>().mockResolvedValueOnce("").mockResolvedValue("day");
    show({ reached });
    await userEvent.type(await screen.findByRole("textbox", { name: "Ask about the backlogs" }), "hello");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText(dayLimitWords)).toBeInTheDocument();
    expect(reached).toHaveBeenCalledTimes(2);
    expect(writingBox()).toBeNull();
  });
});

describe("the page's own usage call", () => {
  const usage = (reached: string) => ({ day_tokens: 10, month_tokens: 20, day_limit: 10, month_limit: 100, reached });

  it("reads the caller's usage without being offered to the model", async () => {
    mcp.callTool.mockResolvedValue(usage("day"));
    await expect(mcpAssistantClient.reached?.()).resolves.toBe("day");
    expect(mcp.callTool).toHaveBeenCalledWith("", "ai_get_my_assistant_usage", {});
  });

  it("reports month, and nothing for an empty or unknown value", async () => {
    mcp.callTool.mockResolvedValueOnce(usage("month")).mockResolvedValueOnce(usage("")).mockResolvedValueOnce(usage("week"));
    await expect(mcpAssistantClient.reached?.()).resolves.toBe("month");
    await expect(mcpAssistantClient.reached?.()).resolves.toBe("");
    await expect(mcpAssistantClient.reached?.()).resolves.toBe("");
  });

  it("answers nothing when the tool is missing or refuses, so the page behaves as before", async () => {
    mcp.callTool.mockRejectedValue(new Error("unknown tool"));
    await expect(mcpAssistantClient.reached?.()).resolves.toBe("");
  });

  it("shows no card and no error when the check refuses", async () => {
    show({ reached: async () => Promise.reject(new Error("agencies: instance not found")) });
    expect(await screen.findByRole("textbox", { name: "Ask about the backlogs" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText(dayLimitWords)).toBeNull();
  });
});
