import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { forgetOpenAgency, openAgency } from "../agency/open";
import { IssuePage } from "../backlogs/IssuePage";
import type { BacklogsClient, Issue, IssueDetail } from "../backlogs/api";
import { SmartBacklogPage } from "./SmartBacklogPage";
import type { SmartBacklogClient } from "./types";

vi.mock("../wakala/mcp", async () => {
  const actual = await vi.importActual<typeof import("../wakala/mcp")>("../wakala/mcp");
  return { ...actual, callTool: async () => ({ items: [] }) };
});

beforeEach(() => openAgency("hub-1"));

afterEach(() => forgetOpenAgency());

const issue: Issue = { id: "t1", title: "SW1 First thing", description: "d", status: "pending", step: "To do", repo: "repo-a", topics: [], backlog: "Backlog", backlogId: "backlog", mark: "Ready", rank: 1 };

const issues: BacklogsClient = {
  backlogs: async () => [],
  issues: async () => [issue],
  issue: async () => ({ ...issue, waitsOn: [], waitedOnBy: [] }) as IssueDetail,
};

const smart: SmartBacklogClient = {
  choices: async () => ({ tag: [], mark: [], backlog: [], step: [], priority: [] }),
  count: async () => 1,
  create: async () => "x",
  read: async (id) => ({ id, name: "Ready to start", set: { match: "all", rules: [] }, issues: 1 }),
  update: async () => undefined,
  mayManage: async () => false,
  remove: async () => undefined,
};

const Where = () => {
  const at = useLocation();
  return <span data-testid="where">{at.pathname}</span>;
};

const open = () =>
  render(
    <MemoryRouter initialEntries={["/a/hub-1/backlogs/ready/smart"]}>
      <Routes>
        <Route path="/a/:agencyId/backlogs/:backlogId/smart" element={<SmartBacklogPage client={smart} issues={issues} manage={{ mayManage: async () => false } as never} />} />
        <Route path="/a/:agencyId/backlogs/issue/:issueId" element={<IssuePage client={issues} notesClient={{ notes: async () => [], addNote: async () => ({}) as never }} />} />
        <Route path="/a/:agencyId/backlogs" element={<span>Backlogs home</span>} />
      </Routes>
      <Where />
    </MemoryRouter>,
  );

const where = () => screen.getByTestId("where").textContent;

describe("going back from an issue opened in a smart backlog", () => {
  it("returns to the smart backlog, and the back button names it", async () => {
    open();
    await userEvent.click(await screen.findByText("First thing"));
    await screen.findAllByText(/SW1/);
    expect(where()).toBe("/a/hub-1/backlogs/issue/t1");
    expect(document.querySelector(".back")?.textContent).toBe("‹ Ready to start");
    await userEvent.click(document.querySelector(".back")!);
    expect(where()).toBe("/a/hub-1/backlogs/ready/smart");
    expect(await screen.findByText("First thing")).toBeInTheDocument();
  });

  it("names where the smart backlog itself goes back to", async () => {
    open();
    await screen.findByText("First thing");
    expect(document.querySelector(".back")?.textContent).toBe("‹ Backlogs");
  });
});
