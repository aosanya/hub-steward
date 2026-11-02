import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { callTool } from "../../wakala/mcp";
import { answering, renderView } from "../spec/usersTesting";
import { WorkflowsView } from "./WorkflowsView";

vi.mock("../../wakala/mcp", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../wakala/mcp")>()),
  callTool: vi.fn(),
}));

const farm = {
  agency_list_workflows: {
    items: [
      { id: "w1", code: "W-1", name: "Buy inputs", description: "Farmers find and buy farm inputs", opens_in: "chat" },
      { id: "w2", code: "W-2", name: "Group order", description: "Farmers buy together" },
      { id: "w3", code: "W-3", name: "Sell harvest", description: "", opens_in: "chat" },
    ],
  },
  agency_list_work_items: {
    items: [
      { id: "i1", workflow_id: "w1", ordinality: 1, title: "Chat with an agent", kind: "chat", role_id: "r2", agent_role_id: "r1" },
      { id: "i2", workflow_id: "w2", ordinality: 1, title: "Start", kind: "fill_form", role_id: "r2" },
      { id: "i3", workflow_id: "w3", ordinality: 1, title: "Chat with an agent", kind: "chat", role_id: "r2" },
    ],
  },
  agency_list_pickers: {
    actors: [
      { id: "r1", name: "Farmers' agent", kind: "role" },
      { id: "r2", name: "Farmer", kind: "role" },
    ],
    answer_types: ["free_text"],
  },
};

const cards = () => Array.from(document.querySelectorAll<HTMLElement>(".card"));

beforeEach(() => {
  vi.mocked(callTool).mockReset();
});

describe("a workflow that opens in a chat, on the Workflows page", () => {
  it("has the chat icon before its name and a Chats with line naming the agent it chats with", async () => {
    answering(farm);
    renderView("workflows", WorkflowsView);
    await screen.findByText("Buy inputs");

    const chat = within(cards()[0]);
    expect(chat.getByRole("img", { name: "Opens in a chat" })).toBeInTheDocument();
    expect(chat.getByText("Chats with").nextElementSibling).toHaveTextContent("Farmers' agent");
    expect(chat.getByText("Roles").nextElementSibling).toHaveTextContent("Farmer");
  });

  it("leaves the icon and the Chats with line off a workflow that opens in a form", async () => {
    answering(farm);
    renderView("workflows", WorkflowsView);
    await screen.findByText("Group order");

    const form = within(cards()[1]);
    expect(form.queryByRole("img", { name: "Opens in a chat" })).not.toBeInTheDocument();
    expect(form.queryByText("Chats with")).not.toBeInTheDocument();
  });

  it("shows a dash for Chats with while its chat step has no agent", async () => {
    answering(farm);
    renderView("workflows", WorkflowsView);
    await screen.findByText("Sell harvest");

    expect(within(cards()[2]).getByText("Chats with").nextElementSibling).toHaveTextContent("—");
  });
});
