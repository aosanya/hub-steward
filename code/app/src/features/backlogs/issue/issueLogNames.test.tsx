import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openAgency } from "../../../shared/wakala/openAgency";
import * as mcp from "../../../shared/wakala/mcp";
import { IssueLog } from "./IssueLog";
import type { NotesClient } from "../shared/api";

const agentId = "dbc62e71-77d3-4b32-91f0-3b17778f0903";
const strangerId = "0a1b2c3d-1111-4222-8333-444455556666";

const note = (text: string) => ({ id: "n1", author: "a1", kind: "person" as const, text, links: [], at: "2026-11-18T20:00:00Z", automatic: true });

const logWith = async (text: string) => {
  const client: NotesClient = { notes: async () => [note(text)], addNote: async () => Promise.reject(new Error("unused")) };
  render(<IssueLog issueId="1" client={client} />);
  await userEvent.click(screen.getByRole("button", { expanded: false }));
};

const answer = (tool: string) => {
  if (tool === "actor_list_actors") return { items: [{ id: "a1", display_name: "Mira Fehér" }] };
  if (tool === "taskmanager_agent_list") return { items: [{ id: agentId, agent_id: "worker-3", display_name: "Rosa Builder" }] };
  return { items: [] };
};

beforeEach(() => {
  openAgency({ id: "hub-1", name: "Hub" } as never);
  vi.spyOn(mcp, "callTool").mockImplementation(async (_agency: string, tool: string) => answer(tool) as never);
});
afterEach(() => vi.restoreAllMocks());

describe("the Log names who an issue was assigned to", () => {
  it("reads the agent's name where the entry holds the agent's id", async () => {
    await logWith(`Assignee none to ${agentId}`);
    expect(await screen.findByText("Assignee none to Rosa Builder")).toBeInTheDocument();
    expect(document.body.textContent).not.toContain(agentId);
  });

  it("never prints an id it cannot name", async () => {
    await logWith(`Assignee ${agentId} to ${strangerId}`);
    await screen.findByText(/Assignee Rosa Builder to /);
    expect(document.body.textContent).not.toContain(strangerId);
  });

  it("leaves an entry without an id as it was", async () => {
    await logWith("Moved to Review with the fix.");
    expect(await screen.findByText("Moved to Review with the fix.")).toBeInTheDocument();
  });
});
