import { holdGroupIn } from "../../shared/testing/holdGroup";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../shared/wakala/openAgency";
import { routes } from "../../app/routes";
import { AssistantPage } from "./AssistantPage";
import type { AssistantClient } from "./api";
import { forgetConversations } from "./session";

vi.mock("../../shared/wakala/mcp", () => ({ callTool: vi.fn(), listTools: vi.fn(), McpError: class extends Error {} }));

beforeEach(() => {
  openAgency("farmers");
  holdGroupIn("farmers");
});

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

const sendQuestion = async () => {
  await userEvent.type(await screen.findByRole("textbox"), "Which issues are assigned to me?");
  await userEvent.click(screen.getByRole("button", { name: "Send" }));
};

describe("an ask that takes several reads", () => {
  it("is not given up on while each read arrives inside the time limit", async () => {
    const ask: AssistantClient["ask"] = (_account, _turns, step) =>
      new Promise((resolve) => {
        const words = ["Reading the backlogs", "Searching the issues", "Opening an issue", "Counting what is pending"];
        words.forEach((line, index) => setTimeout(() => step?.(line), 40 * (index + 1)));
        setTimeout(() => resolve({ text: "Three issues are assigned to you.", lists: [] }), 200);
      });
    show({ model: async () => "acc1", ask }, 80);
    await sendQuestion();
    expect(await screen.findByText("Three issues are assigned to you.", undefined, { timeout: 2000 })).toBeInTheDocument();
  });

  it("names the last thing it was doing when it is given up on", async () => {
    const ask: AssistantClient["ask"] = (_account, _turns, step) =>
      new Promise(() => {
        step?.("Opening an issue");
      });
    show({ model: async () => "acc1", ask }, 40);
    await sendQuestion();
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("No answer came in time.");
    expect(alert).toHaveTextContent("Opening an issue");
  });
});
