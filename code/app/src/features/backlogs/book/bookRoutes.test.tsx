import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { forgetOpenAgency, openAgency } from "../../../shared/wakala/openAgency";
import * as mcp from "../../../shared/wakala/mcp";
import { backlogTools } from "../manage/api";
import { rulebookTools } from "../rulebook";
import { taskTools } from "../shared/api";
import { BacklogsRoutes } from "../BacklogsRoutes";

vi.mock("../../inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

let permissions = ["task.read", "rule.read"];

const answer = (tool: string): unknown => {
  if (tool === backlogTools.myRoles) return { permissions };
  if (tool === rulebookTools.list) return { items: [{ id: "id-R-1", code: "R-1", kind: "rule", title: "No comments in code", body: "Because.", status: "in_force" }] };
  return { items: [], modules: [] };
};

beforeEach(() => {
  permissions = ["task.read", "rule.read"];
  openAgency("hub-1");
  vi.spyOn(mcp, "listTools").mockResolvedValue([]);
  vi.spyOn(mcp, "callTool").mockImplementation(async (_hub: string, tool: string) => answer(tool) as never);
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

const openAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/a/:agencyId/backlogs/*" element={<BacklogsRoutes />} />
      </Routes>
    </MemoryRouter>,
  );

const listCalls = () => vi.mocked(mcp.callTool).mock.calls.filter((call) => call[1] === rulebookTools.list);

describe("the Book route", () => {
  it("opens the Book at the book address with one list call for rules in force", async () => {
    openAt("/a/hub-1/backlogs/book");
    expect(await screen.findByRole("heading", { level: 1, name: "Best practices" })).toBeInTheDocument();
    expect(screen.getByText("Because.")).toBeInTheDocument();
    expect(listCalls()).toEqual([["", rulebookTools.list, { kind: "rule", status: ["in_force"] }]]);
  });

  it("shows the no-access card and makes no list call without rule.read", async () => {
    permissions = ["task.read"];
    openAt("/a/hub-1/backlogs/book");
    expect(await screen.findByText("You do not have access to the rules yet. Ask the Product owner.")).toBeInTheDocument();
    expect(listCalls()).toEqual([]);
  });

  it("does not open the issues screen for the book address, and still does for a backlog id", async () => {
    openAt("/a/hub-1/backlogs/book");
    await screen.findByRole("heading", { level: 1, name: "Best practices" });
    expect(vi.mocked(mcp.callTool).mock.calls.some((call) => call[1] === taskTools.pending)).toBe(false);
    cleanup();
    vi.mocked(mcp.callTool).mockClear();
    openAt("/a/hub-1/backlogs/b1");
    await screen.findByRole("main");
    expect(screen.queryByRole("heading", { level: 1, name: "Best practices" })).toBeNull();
    expect(listCalls()).toEqual([]);
  });
});
