import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { forgetOpenAgency, openAgency } from "../../../shared/wakala/openAgency";
import * as mcp from "../../../shared/wakala/mcp";
import { BacklogsRoutes } from "../BacklogsRoutes";

vi.mock("../../inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

const record = (code: string, kind: string, title: string) => ({ id: `id-${code}`, code, kind, title, status: kind === "decision" ? "decided" : "in_force", tags: ["css"] });

const answer = (tool: string, args: Record<string, unknown> = {}): unknown => {
  if (tool === "agency_get_my_roles") return { permissions: ["task.read", "rule.read"] };
  if (tool === "taskmanager_backlog_decisions_list") return [record("D-3", "decision", "A good example is a link")];
  if (tool === "taskmanager_backlog_rules_list") return [record("R-2", "rule", "Font sizes are in rem")];
  if (tool === "taskmanager_rule_read") return record(String(args.ruleCode), String(args.ruleCode).startsWith("D") ? "decision" : "rule", "A good example is a link");
  return { items: [], modules: [] };
};

beforeEach(() => {
  openAgency("hub-1");
  vi.spyOn(mcp, "listTools").mockResolvedValue([]);
  vi.spyOn(mcp, "callTool").mockImplementation(async (_hub: string, tool: string, args: Record<string, unknown> = {}) => answer(tool, args) as never);
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

describe("the rulebook routes", () => {
  it("opens the list of one kind for the rulebook address of a backlog", async () => {
    openAt("/a/hub-1/backlogs/b1/rulebook?kind=decision");
    expect(await screen.findByText("A good example is a link")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Decisions" })).toHaveAttribute("aria-pressed", "true");
    expect(mcp.callTool).toHaveBeenCalledWith("", "taskmanager_backlog_decisions_list", { backlogID: "b1", status: ["decided", "proposed"] });
  });

  it("opens one record for the rule address", async () => {
    openAt("/a/hub-1/backlogs/rule/D-3");
    expect(await screen.findByText("D-3 · Decision")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "A good example is a link" })).toBeInTheDocument();
  });

  it("opens the rule list of a backlog by its rulebook address and keeps the placeholder out", async () => {
    openAt("/a/hub-1/backlogs/b1/rulebook?kind=rule");
    expect(await screen.findByText("Font sizes are in rem")).toBeInTheDocument();
    expect(screen.queryByTestId("rulebook-placeholder")).toBeNull();
  });

  it("still opens the smart backlog editor at the rules address of a backlog", async () => {
    openAt("/a/hub-1/backlogs/b1/rules");
    await screen.findByRole("main");
    expect(screen.queryByText("Font sizes are in rem")).toBeNull();
    expect(mcp.callTool).not.toHaveBeenCalledWith("", "taskmanager_backlog_rules_list", expect.anything());
  });
});
