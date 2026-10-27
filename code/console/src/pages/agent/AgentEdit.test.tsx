import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { refused, renderAgentEdit, type Replies } from "./testing";

vi.mock("../../data/agent");

const dispatcher = { rows: [{ name: "Dispatcher", account_id: "a1", options: [{ id: "a1", label: "GLM-5.3" }] }] };

const replies: Replies = {
  agentRows: dispatcher,
  agentLimits: { rows: [] },
  agentInstructions: { parts: [], fine_tuning: "", use_agency_instructions: true },
};

describe("the agent edit page", () => {
  it("shows the agent's name as the title with the three tabs and the Model tab current", async () => {
    renderAgentEdit("/h/h1/agent-edit/dispatcher/model", replies);
    expect(await screen.findByRole("heading", { level: 1, name: "Dispatcher" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Model" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Limits" })).toHaveAttribute("href", "/h/h1/agent-edit/dispatcher/limits");
    expect(screen.getByRole("link", { name: "Instructions" })).toHaveAttribute(
      "href",
      "/h/h1/agent-edit/dispatcher/instructions",
    );
  });

  it("opens the Model tab for a tab name it does not know", async () => {
    renderAgentEdit("/h/h1/agent-edit/dispatcher/elsewhere", replies);
    expect(await screen.findByLabelText("Model")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Model" })).toHaveAttribute("aria-current", "page");
  });

  it("keeps the agent's name as the title while switching between the tabs", async () => {
    const calls = renderAgentEdit("/h/h1/agent-edit/dispatcher/model", replies);
    await screen.findByRole("heading", { level: 1, name: "Dispatcher" });

    await userEvent.click(screen.getByRole("link", { name: "Limits" }));
    expect(screen.getByRole("heading", { level: 1, name: "Dispatcher" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Limits" })).toHaveAttribute("aria-current", "page");

    await userEvent.click(screen.getByRole("link", { name: "Instructions" }));
    expect(screen.getByRole("heading", { level: 1, name: "Dispatcher" })).toBeInTheDocument();
    await screen.findByLabelText("Fine-tuning");

    await userEvent.click(screen.getByRole("link", { name: "Model" }));
    expect(screen.getByRole("heading", { level: 1, name: "Dispatcher" })).toBeInTheDocument();

    expect(calls.filter((c) => c.fn === "agentRows")).toEqual([{ fn: "agentRows", args: ["h1", "dispatcher"] }]);
  });

  it("falls back to the role as the title when the agent cannot be loaded, and says so on the Model tab", async () => {
    renderAgentEdit("/h/h1/agent-edit/dispatcher/model", { agentRows: refused() });
    expect(await screen.findByText("The page could not be loaded.")).toHaveClass("empty", "error");
    expect(screen.getByRole("heading", { level: 1, name: "dispatcher" })).toBeInTheDocument();
  });

  it("says nothing is here yet when the role has no row", async () => {
    renderAgentEdit("/h/h1/agent-edit/dispatcher/model", { agentRows: { rows: [] } });
    expect(await screen.findByText("Nothing here yet.")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByLabelText("Model")).not.toBeInTheDocument());
  });
});
