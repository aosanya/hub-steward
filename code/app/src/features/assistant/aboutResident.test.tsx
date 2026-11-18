import { act, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { routes } from "../../app/routes";
import { carryChatAbout, clearCarriedChatAbout, forgetChatAbout, useChatAboutOpen } from "../../app/chatAbout";
import { forgetOpenAgency, openAgency } from "../../shared/wakala/openAgency";
import { askAssistant, offeredNames, type AssistantClient } from "./api";
import { AssistantPage, askPlaceholder, emptyWords } from "./AssistantPage";

const mcp = vi.hoisted(() => ({ callTool: vi.fn(), listTools: vi.fn() }));

vi.mock("../../shared/wakala/mcp", () => ({ callTool: mcp.callTool, listTools: mcp.listTools, McpError: class extends Error {} }));

const resident = { kind: "resident" as const, id: "p1", name: "Takács Erzsébet" };

const carryResident = () => {
  const hook = renderHook(() => useChatAboutOpen(resident));
  carryChatAbout();
  hook.unmount();
};

const client: AssistantClient = { model: async () => "acc1", ask: vi.fn() };

const show = () =>
  render(
    <MemoryRouter initialEntries={["/a/zoldhalom/chat/assistant"]}>
      <Routes>
        <Route path={routes.assistant.pattern} element={<AssistantPage client={client} />} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  openAgency("zoldhalom");
  forgetChatAbout();
  mcp.callTool.mockReset();
  mcp.listTools.mockReset();
  mcp.listTools.mockResolvedValue(offeredNames.map((name) => ({ name, description: name, inputSchema: { type: "object", properties: {}, required: [] } })));
  mcp.callTool.mockImplementation(async (_hub: string, name: string) => (name === "ai_chat_account" ? { message: { content: "done" } } : { items: [] }));
});

afterEach(() => {
  forgetChatAbout();
  forgetOpenAgency();
});

describe("with a resident carried the screen speaks of that resident", () => {
  it("names the resident's four lists in one short line, with no backlog sentence and no cannot-read sentence", async () => {
    carryResident();
    show();
    const line = await screen.findByText(/bills, holdings, applications and raised items/, { selector: "p" });
    expect(line).toHaveTextContent("Ask about Takács Erzsébet: bills, holdings, applications and raised items.");
    expect(line).not.toHaveTextContent(/backlogs/i);
    expect(line).not.toHaveTextContent(/cannot/i);
    expect(screen.queryByText(emptyWords, { selector: "p" })).toBeNull();
  });

  it("invites a question about the resident and takes focus on arrival", async () => {
    carryResident();
    show();
    const field = await screen.findByRole("textbox", { name: "Ask about Takács Erzsébet" });
    expect(field).toHaveAttribute("placeholder", "Ask about Takács Erzsébet");
    expect(field).toHaveFocus();
  });

  it("returns the backlog texts when the About line is cleared", async () => {
    carryResident();
    show();
    await screen.findByRole("textbox", { name: "Ask about Takács Erzsébet" });
    await userEvent.click(screen.getByRole("button", { name: "Clear About Takács Erzsébet" }));
    expect(await screen.findByText(emptyWords, { selector: "p" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: askPlaceholder })).toBeInTheDocument();
  });
});

describe("with no resident carried the texts are as they were", () => {
  it("speaks of the backlogs only and leaves focus alone", async () => {
    show();
    const field = await screen.findByRole("textbox", { name: "Ask about the backlogs" });
    expect(screen.getByText(emptyWords, { selector: "p" })).toBeInTheDocument();
    expect(field).not.toHaveFocus();
  });
});

describe("the system line for the carried resident keeps the assistant on the topic", () => {
  const systemLines = () => {
    const chat = mcp.callTool.mock.calls.find(([, name]) => name === "ai_chat_account");
    return (chat?.[2] as { messages: { role: string; content: string }[] }).messages.filter((message) => message.role === "system").map((message) => message.content).join("\n");
  };

  it("tells the assistant to answer about that resident and keep to them unless asked about something else", async () => {
    carryResident();
    await askAssistant("acc1", [{ role: "user", content: "what do they owe?" }]);
    const text = systemLines();
    expect(text).toContain(resident.name);
    expect(text).toMatch(/answer about this resident/i);
    expect(text).toMatch(/keep to (this resident|them)[^.]*unless/i);
    expect(text).toMatch(/what do they owe/i);
  });

  it("drops the topic when the About line is cleared", async () => {
    carryResident();
    act(() => clearCarriedChatAbout());
    await askAssistant("acc1", [{ role: "user", content: "what do they owe?" }]);
    const text = systemLines();
    expect(text).not.toContain(resident.name);
    expect(text).not.toMatch(/keep to/i);
  });
});

describe("the writing box of the assistant is white", () => {
  const css = readFileSync(resolve(__dirname, "assistant.css"), "utf8");
  const rule = (selector: string) => css.split("\n").find((line) => line.includes(selector)) ?? "";

  it("paints the strip and the field with the surface token the cards use, keeping the field's border", () => {
    expect(rule(".assistant-compose .rm-composer")).toMatch(/background:\s*var\(--surface\)/);
    expect(rule(".assistant-compose .rm-field")).toMatch(/background:\s*var\(--surface\)/);
    expect(rule(".assistant-compose .rm-field")).not.toMatch(/border:\s*0|border:\s*none/);
  });

  it("sets no font size in pixels", () => {
    expect(css).not.toMatch(/font-size:\s*[\d.]+px/);
  });
});
