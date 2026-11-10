import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../agency/open";
import { routes } from "../routes";
import { AssistantPage } from "./AssistantPage";
import type { AssistantClient } from "./api";
import { moveTool } from "./confirm";
import { forgetConversations } from "./session";

vi.mock("../wakala/mcp", () => ({ callTool: vi.fn(), listTools: vi.fn(), McpError: class extends Error {} }));

beforeEach(() => openAgency("farmers"));

afterEach(() => {
  forgetOpenAgency();
  forgetConversations();
});

const show = (client: AssistantClient, timeoutMs: number) =>
  render(
    <MemoryRouter initialEntries={["/a/farmers/chat/assistant"]}>
      <Routes>
        <Route path={routes.assistant.pattern} element={<AssistantPage client={client} timeoutMs={timeoutMs} />} />
      </Routes>
    </MemoryRouter>,
  );

describe("an ask the page has given up on", () => {
  it("cannot raise a confirm card afterwards, and its write is declined", async () => {
    const decided: boolean[] = [];
    const ask: AssistantClient["ask"] = (_account, _turns, _step, confirm) =>
      new Promise((resolve) => {
        setTimeout(() => {
          void confirm?.({ tool: moveTool, arguments: { issue: "i1", step: "s1" } }).then((confirmed) => {
            decided.push(confirmed);
            resolve({ text: "moved", lists: [] });
          });
        }, 120);
      });
    show({ model: async () => "acc1", ask }, 30);
    await userEvent.type(await screen.findByRole("textbox"), "move it");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("No answer came in time.");
    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(screen.queryByRole("button", { name: "Move" })).toBeNull();
    expect(decided).toEqual([false]);
    expect(screen.queryByText("moved")).toBeNull();
  });
});
