import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { openAgency } from "../agency/open";
import * as mcp from "../wakala/mcp";
import { BacklogBoard } from "../backlogBoard/BacklogBoard";
import { BacklogsRoutes } from "./BacklogsRoutes";
import { taskTools } from "./api";

const hub = "hub-1";
const tasks = Array.from({ length: 6 }, (_, i) => ({
  id: `t${i}`,
  title: `DEV-00${i} Thing ${i}`,
  rank: i + 1,
  status: i % 2 ? "blocked" : "pending",
  state: "To do",
  project_name: "repo-a",
  tags: [i % 2 ? "Blocked" : "Ready", "repo-a"],
  description: "d",
  backlog: "backlog",
  step: "to-do",
}));

beforeEach(() => {
  openAgency(hub);
  vi.spyOn(mcp, "callTool").mockImplementation((async (_h: string, tool: string, args: Record<string, unknown> = {}) => {
    switch (tool) {
      case taskTools.list:
        return { items: tasks };
      case taskTools.backlogs:
        return { items: [{ id: "backlog", name: "Backlog", issues: 6, steps: [{ id: "to-do", name: "To do", issues: 6 }] }] };
      case taskTools.get:
        return tasks.find((one) => one.id === args.taskID);
      case taskTools.edges:
        return args.id === "t2" || args.vertex_id === "t2"
          ? args.direction === "outbound"
            ? { items: [{ from_id: "t2", to_id: "t1" }] }
            : { items: [] }
          : { items: [] };
      case "agency_get_agency":
        return { id: hub, name: "Hub Steward SWE" };
      default:
        return { items: [], modules: [] };
    }
  }) as never);
});

const Where = () => {
  const at = useLocation();
  return <span data-testid="where">{at.pathname + at.search}</span>;
};

const app = (start: string) =>
  render(
    <MemoryRouter initialEntries={[start]}>
      <Routes>
        <Route path="/a/:agencyId/backlogs/*" element={<BacklogsRoutes />} />
        <Route path="/a/:agencyId/backlogs/:backlogId/board" element={<BacklogBoard />} />
      </Routes>
      <Where />
    </MemoryRouter>,
  );

const where = () => screen.getByTestId("where").textContent;

describe("the back label of an issue page", () => {
  it("returns to the filtered list it was opened from, with its tag and search, under the list's name", async () => {
    app("/a/hub-1/backlogs/backlog?tag=Blocked&q=thing");
    await screen.findByText(/of 6 issues/);
    await userEvent.click(document.querySelector(".issue-row .open")!);
    await screen.findByText("Source", {}, { timeout: 2000 }).catch(() => undefined);
    expect(where()).toMatch(/\/issue\//);
    expect(document.querySelector(".back")?.textContent).toContain("Backlog");
    await userEvent.click(document.querySelector(".back")!);
    expect(where()).toBe("/a/hub-1/backlogs/backlog?tag=Blocked&q=thing");
  });

  it("is All issues when the page is opened by a typed address", async () => {
    app("/a/hub-1/backlogs/issue/t3");
    await screen.findAllByText(/DEV-003/);
    expect(document.querySelector(".back")?.textContent).toContain("All issues");
    await userEvent.click(document.querySelector(".back")!);
    expect(where()).toBe("/a/hub-1/backlogs/all");
  });

  it("returns from a waited-on issue to the issue it was opened from, under that issue's code", async () => {
    app("/a/hub-1/backlogs/issue/t2");
    await screen.findByText("Waits on");
    const row = screen.getByText(/Thing 1/).closest(".issue-row")!;
    await userEvent.click(row.querySelector(".open")!);
    await screen.findAllByText(/DEV-001/);
    expect(document.querySelector(".back")?.textContent).toContain("DEV-002");
    await userEvent.click(document.querySelector(".back")!);
    expect(where()).toBe("/a/hub-1/backlogs/issue/t2");
  });
});
