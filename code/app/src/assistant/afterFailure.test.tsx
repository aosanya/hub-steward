import { act, screen, within } from "@testing-library/react";
import { forgetOpenAgency, openAgency } from "../agency/open";
import { failedWords } from "./AssistantPage";
import type { AssistantClient } from "./api";
import { say, showAssistant } from "./assistantScreen";
import { forgetConversations } from "./session";

vi.mock("../wakala/mcp", () => ({ callTool: vi.fn(), listTools: vi.fn(), McpError: class extends Error {} }));

beforeEach(() => openAgency("farmers"));

afterEach(() => {
  forgetOpenAgency();
  forgetConversations();
});

const show = (ask: AssistantClient["ask"]) => showAssistant({ ask });

const tryAgain = async () => {
  const alert = await screen.findByRole("alert");
  await act(async () => within(alert).getByRole("button", { name: "Try again" }).click());
};

const answered = (text: string) => ({ text, lists: [] });

describe("after a request fails", () => {
  it("keeps a message written while the failure card shows queued, asks nothing, and sends both after Try again", async () => {
    const ask = vi.fn().mockRejectedValueOnce(new Error("down")).mockResolvedValueOnce(answered("first answer")).mockResolvedValueOnce(answered("second answer"));
    show(ask);
    await say("one");
    expect(await screen.findByRole("alert")).toHaveTextContent(failedWords);
    await say("two");
    expect(screen.getByText("two").closest(".rm-msg")).toHaveTextContent("Queued");
    expect(ask).toHaveBeenCalledTimes(1);
    await tryAgain();
    expect(await screen.findByText("first answer")).toBeInTheDocument();
    expect(await screen.findByText("second answer")).toBeInTheDocument();
    expect(ask).toHaveBeenCalledTimes(3);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows the failure card again when Try again fails too, and asks once for each press", async () => {
    const ask = vi.fn().mockRejectedValueOnce(new Error("down")).mockRejectedValueOnce(new Error("still down")).mockResolvedValueOnce(answered("back"));
    show(ask);
    await say("one");
    expect(await screen.findByRole("alert")).toHaveTextContent(failedWords);
    await tryAgain();
    expect(await screen.findByRole("alert")).toHaveTextContent(failedWords);
    expect(ask).toHaveBeenCalledTimes(2);
    await tryAgain();
    expect(await screen.findByText("back")).toBeInTheDocument();
    expect(ask).toHaveBeenCalledTimes(3);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
