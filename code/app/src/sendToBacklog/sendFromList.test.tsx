import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { openAgency } from "../agency/open";
import { IssuesPage } from "../backlogs/IssuesPage";
import type { BacklogsClient, Issue } from "../backlogs/api";
import * as mcp from "../wakala/mcp";
import { sendTools } from "./api";

const issue = (id: string, title: string, rank: number): Issue => ({ id, title, description: "", status: "pending", step: "To do", repo: "hub-steward", topics: [], backlog: "Software", mark: "Ready", rank });

const client: BacklogsClient = {
  backlogs: async () => [],
  issues: async () => [issue("t1", "HS-001 Fix mirrored board drift", 1), issue("t2", "HS-002 Import the municipality", 2), issue("t3", "HS-003 Record the voice clips", 3)],
  issue: async () => {
    throw new Error("not used");
  },
};

const hubBacklogs = {
  items: [
    { id: "b1", name: "Software", issues: 3, steps: [{ id: "s1", name: "To do" }] },
    { id: "b2", name: "Documentation", issues: 0, steps: [{ id: "d1", name: "Draft" }] },
  ],
};

const page = () =>
  render(
    <MemoryRouter initialEntries={["/backlogs/issues"]}>
      <Routes>
        <Route path="/backlogs/issues" element={<IssuesPage client={client} />} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.restoreAllMocks();
  openAgency("hub-1");
});

describe("sending from the list", () => {
  it("selects two issues, sends them to a backlog and confirms in one line", async () => {
    const call = vi.spyOn(mcp, "callTool").mockImplementation((async (_hub: string, tool: string) => (tool === sendTools.move ? {} : hubBacklogs)) as never);
    page();
    await userEvent.click(await screen.findByRole("button", { name: "Select" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Select HS-001 Fix mirrored board drift" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Select HS-003 Record the voice clips" }));
    expect(screen.getByText("2 selected")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Send to backlog" }));
    const sheet = await screen.findByRole("dialog", { name: "Send 2 issues to" });
    await userEvent.click(within(sheet).getByText("Documentation"));
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("2 issues sent to Documentation"));
    expect(call).toHaveBeenCalledWith("", sendTools.move, { taskID: "t1", backlog: "b2", step: "d1" });
    expect(call).toHaveBeenCalledWith("", sendTools.move, { taskID: "t3", backlog: "b2", step: "d1" });
    expect(screen.queryByText("2 selected")).toBeNull();
  });

  it("ticks every row with All and leaves selecting with Cancel", async () => {
    vi.spyOn(mcp, "callTool").mockResolvedValue(hubBacklogs as never);
    page();
    await userEvent.click(await screen.findByRole("button", { name: "Select" }));
    await userEvent.click(screen.getByRole("button", { name: "All" }));
    expect(screen.getByText("3 selected")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /Cancel/ }));
    expect(screen.queryByText("3 selected")).toBeNull();
    expect(screen.getByRole("button", { name: "Select" })).toBeTruthy();
  });

  it("offers no Select when there is nowhere to send", async () => {
    vi.spyOn(mcp, "callTool").mockResolvedValue({ items: [] } as never);
    page();
    await screen.findByText(/Fix mirrored board drift/);
    expect(screen.queryByRole("button", { name: "Select" })).toBeNull();
  });
});
