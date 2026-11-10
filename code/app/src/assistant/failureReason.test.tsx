import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { McpError } from "../wakala/mcp";
import { say, showAssistant } from "./assistantScreen";
import { failureReason } from "./failureReason";

const secret = "sk-live-9f8e7d6c5b4a39281716151413121110";

describe("failureReason", () => {
  it("says a refused sign-in in plain words", () => {
    expect(failureReason(new McpError("not signed in", true))).toBe("Your session ended. Sign in again.");
  });

  it("says a network failure in plain words", () => {
    expect(failureReason(new TypeError("Failed to fetch"))).toBe("We could not reach the hub");
    expect(failureReason(new TypeError("Load failed"))).toBe("We could not reach the hub");
  });

  it("says too many requests for a 429 that is not the assistant limit", () => {
    expect(failureReason(new McpError("wakala answered 429: slow down"))).toBe("Too many requests. Try again in a minute.");
  });

  it("never confirms that an agency exists", () => {
    expect(failureReason(new McpError("ai_chat_account: agencies: instance not found"))).toBe("You do not have access to this yet.");
  });

  it("gives the hub's own reason without the tool or module prefix", () => {
    expect(failureReason(new McpError("ai_chat_account: ai: the account has no model set"))).toBe("the account has no model set");
    expect(failureReason(new McpError("taskmanager_task_move_to_step: agencies: backlog access forbidden: moving needs Can move on both backlogs"))).toBe(
      "backlog access forbidden: moving needs Can move on both backlogs",
    );
  });

  it("cuts a long reason to one line", () => {
    const reason = failureReason(new McpError(`ai_chat_account: ai: ${"word ".repeat(80)}`));
    expect(reason.length).toBeLessThanOrEqual(121);
    expect(reason).not.toContain("\n");
  });

  it("never carries a token, an address or a stack", () => {
    const reason = failureReason(new McpError(`ai_chat_account: ai: call to https://api.example.com/v1/chat failed with key ${secret} Bearer abcdefghijklmnopqrstuvwxyz0123456789\n    at run (file.js:1:1)`));
    expect(reason).not.toContain(secret);
    expect(reason).not.toContain("https://");
    expect(reason).not.toContain("Bearer");
    expect(reason).not.toContain("file.js");
    expect(reason).not.toContain("\n");
  });

  it("says nothing for a failure with no words of its own", () => {
    expect(failureReason(new Error(""))).toBe("");
    expect(failureReason("odd")).toBe("");
  });

  it("says no answer came in time for the page's own give-up", () => {
    expect(failureReason(new Error("slow"))).toBe("No answer came in time.");
  });
});

describe("the failure card", () => {
  it("shows the reason in a grey line under the sentence", async () => {
    showAssistant({ ask: vi.fn().mockRejectedValue(new McpError("ai_chat_account: ai: the account has no model set")) });
    await say("list them");
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("That did not work. Try again.");
    expect(within(alert).getByText("the account has no model set")).toBeInTheDocument();
  });

  it("shows no reason line and no secret when the failure carries none that is safe", async () => {
    showAssistant({ ask: vi.fn().mockRejectedValue(new McpError(`ai_chat_account: ai: ${secret}`)) });
    await say("list them");
    const alert = await screen.findByRole("alert");
    expect(alert).not.toHaveTextContent(secret);
    expect(alert.querySelector(".assistant-reason")).toBeNull();
  });

  it("shows the plain sentence for a session that ended", async () => {
    showAssistant({ ask: vi.fn().mockRejectedValue(new McpError("not signed in", true)) });
    await say("list them");
    expect(await screen.findByText("Your session ended. Sign in again.")).toBeInTheDocument();
  });
});
