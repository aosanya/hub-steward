import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { openAgency } from "../agency/open";
import { taskTools } from "../backlogs/api";
import * as mcp from "../wakala/mcp";
import { ResultsPanel } from "./ResultsPanel";
import { draftOf } from "./results";

const Where = () => {
  const at = useLocation();
  return <span data-testid="where">{JSON.stringify({ path: at.pathname + at.search, state: at.state })}</span>;
};

const list = () => {
  const draft = draftOf(
    "taskmanager_task_pending",
    {},
    { total: 1, items: [{ id: "a", title: "DEV-001 A thing", state: "To do", backlog: "backlog", step: "to-do", tags: ["repo-a"], rank: 1, blocked: true }] },
  )!;
  return { ...draft, id: "r1" };
};

beforeEach(() => {
  openAgency("hub-1");
  vi.spyOn(mcp, "callTool").mockImplementation((async (_h: string, tool: string) =>
    tool === taskTools.backlogs ? { items: [{ id: "backlog", name: "Backlog", issues: 1, steps: [] }] } : { items: [] }) as never);
});

describe("an issue opened from the assistant's results", () => {
  it("shows a Blocked pill and the backlog's name, and opens with the way back to the assistant", async () => {
    render(
      <MemoryRouter initialEntries={["/a/hub-1/chat/assistant"]}>
        <ResultsPanel results={[list()]} picked="r1" onPick={() => undefined} />
        <Where />
      </MemoryRouter>,
    );
    expect(await screen.findByText("Backlog")).toBeTruthy();
    expect(screen.getByText("Blocked")).toBeTruthy();
    await userEvent.click(document.querySelector(".issue-row .open")!);
    const at = JSON.parse(screen.getByTestId("where").textContent ?? "{}");
    expect(at.path).toMatch(/\/issue\/a$/);
    expect(at.state).toEqual({ backTo: "/a/hub-1/chat/assistant", backLabel: "Hub Steward" });
  });
});
