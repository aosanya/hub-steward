import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { forgetOpenAgency, openAgency } from "../../../shared/wakala/openAgency";
import { IssuesPage } from "../issue/IssuesPage";
import type { BacklogManageClient } from "../manage/types";
import type { Backlog, BacklogsClient, Issue } from "../shared/api";
import { SmartBacklogPage } from "../smart/SmartBacklogPage";
import type { SmartBacklogClient } from "../smart/types";
import { BacklogBoard } from "./BacklogBoard";

const roles = vi.hoisted(() => ({ reply: {} as unknown }));

vi.mock("../../../shared/wakala/mcp", async () => {
  const actual = await vi.importActual<typeof import("../../../shared/wakala/mcp")>("../../../shared/wakala/mcp");
  return { ...actual, callTool: async (_hub: string, tool: string) => (tool === "agency_get_my_roles" ? roles.reply : { items: [] }) };
});

const mayRead = { permissions: ["task.read", "rule.read"] };

const mayNotRead = { permissions: ["task.read"] };

beforeEach(() => {
  roles.reply = mayNotRead;
  openAgency("hub-1");
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
});

const issue: Issue = { id: "t1", title: "First thing", description: "d", status: "pending", step: "To do", repo: "repo-a", topics: [], backlog: "Backlog", backlogId: "backlog", mark: "Ready", rank: 1 };
const backlog: Backlog = { id: "backlog", name: "Backlog", steps: ["To do", "Done"], issues: 1 };
const issues: BacklogsClient = { backlogs: async () => [backlog], issues: async () => [issue], issue: async () => ({}) as never };
const manage = { mayManage: async () => false } as unknown as BacklogManageClient;
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
  const place = useLocation();
  return <p data-testid="where">{place.pathname + place.search}</p>;
};

const at = (path: string, route: string, element: JSX.Element) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={route} element={element} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );

const issuesAt = (path: string) => at(path, "/a/:agencyId/backlogs/:backlogId", <IssuesPage client={issues} manage={manage} smartBacklogs={async () => []} />);

const names = () => screen.getAllByRole("group", { name: "View" })[0].querySelectorAll("button");

const choices = () => Array.from(names()).map((button) => button.textContent);

const where = () => screen.getByTestId("where").textContent;

describe("the three screens that show the view switch", () => {
  it("All issues offers List and Board only, and Board and List still flip the view in place", async () => {
    issuesAt("/a/hub-1/backlogs/all");
    await screen.findByText("First thing");
    expect(choices()).toEqual(["List", "Board"]);
    await userEvent.click(screen.getByRole("button", { name: "Board" }));
    expect(screen.getByRole("button", { name: "Board" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(screen.getByRole("button", { name: "List" }));
    expect(screen.getByRole("button", { name: "List" })).toHaveAttribute("aria-pressed", "true");
  });

  it("a named backlog list offers List and Board only, and Board opens the board of that backlog", async () => {
    issuesAt("/a/hub-1/backlogs/backlog?tag=Ready");
    await screen.findByText("First thing");
    expect(choices()).toEqual(["List", "Board"]);
    await userEvent.click(screen.getByRole("button", { name: "Board" }));
    expect(where()).toBe("/a/hub-1/backlogs/backlog/board?tag=Ready");
  });

  it("a board offers List and Board only, and List opens the list of that backlog", async () => {
    at("/a/hub-1/backlogs/backlog/board?tag=Ready", "/a/:agencyId/backlogs/:backlogId/board", <BacklogBoard client={issues} />);
    await screen.findByText("First thing");
    expect(choices()).toEqual(["List", "Board"]);
    await userEvent.click(screen.getByRole("button", { name: "List" }));
    expect(where()).toBe("/a/hub-1/backlogs/backlog?tag=Ready");
  });

  it("a smart backlog offers List and Board only, and List keeps the view in the address", async () => {
    at("/a/hub-1/backlogs/ready/smart", "/a/:agencyId/backlogs/:backlogId/smart", <SmartBacklogPage client={smart} issues={issues} manage={manage} />);
    await screen.findByText("First thing");
    expect(choices()).toEqual(["List", "Board"]);
    expect(screen.getByRole("button", { name: "Board" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(screen.getByRole("button", { name: "List" }));
    expect(screen.getByRole("button", { name: "List" })).toHaveAttribute("aria-pressed", "true");
  });
});

const rulebookChoices = ["List", "Board", "Rules", "Decisions", "Questions"];

const pick = async (name: string) => userEvent.click(screen.getByRole("button", { name }));

describe("the three screens for a viewer who may read rules", () => {
  beforeEach(() => {
    roles.reply = mayRead;
  });

  it("All issues offers five choices, and Rules, Decisions and Questions open the rulebook of all", async () => {
    issuesAt("/a/hub-1/backlogs/all");
    await screen.findByText("First thing");
    await waitFor(() => expect(choices()).toEqual(rulebookChoices));
    await pick("Rules");
    expect(where()).toBe("/a/hub-1/backlogs/all/rulebook?kind=rule");
  });

  it.each([
    ["Decisions", "decision"],
    ["Questions", "question"],
  ])("a named backlog list opens the %s of that backlog", async (name, kind) => {
    issuesAt("/a/hub-1/backlogs/backlog?tag=Ready");
    await screen.findByText("First thing");
    await waitFor(() => expect(choices()).toEqual(rulebookChoices));
    await pick(name);
    expect(where()).toBe(`/a/hub-1/backlogs/backlog/rulebook?kind=${kind}`);
  });

  it("a board opens the rules of that backlog, and Board and List still go where they went", async () => {
    at("/a/hub-1/backlogs/backlog/board?tag=Ready", "/a/:agencyId/backlogs/:backlogId/board", <BacklogBoard client={issues} />);
    await screen.findByText("First thing");
    await waitFor(() => expect(choices()).toEqual(rulebookChoices));
    await pick("Rules");
    expect(where()).toBe("/a/hub-1/backlogs/backlog/rulebook?kind=rule");
  });

  it("a board still opens the list on List", async () => {
    at("/a/hub-1/backlogs/backlog/board?tag=Ready", "/a/:agencyId/backlogs/:backlogId/board", <BacklogBoard client={issues} />);
    await screen.findByText("First thing");
    await waitFor(() => expect(choices()).toEqual(rulebookChoices));
    await pick("List");
    expect(where()).toBe("/a/hub-1/backlogs/backlog?tag=Ready");
  });

  it("a named backlog list still opens the board on Board", async () => {
    issuesAt("/a/hub-1/backlogs/backlog?tag=Ready");
    await screen.findByText("First thing");
    await waitFor(() => expect(choices()).toEqual(rulebookChoices));
    await pick("Board");
    expect(where()).toBe("/a/hub-1/backlogs/backlog/board?tag=Ready");
  });

  it("a smart backlog opens the rules of that backlog and keeps List and Board in place", async () => {
    at("/a/hub-1/backlogs/ready/smart", "/a/:agencyId/backlogs/:backlogId/smart", <SmartBacklogPage client={smart} issues={issues} manage={manage} />);
    await screen.findByText("First thing");
    await waitFor(() => expect(choices()).toEqual(rulebookChoices));
    await pick("List");
    expect(screen.getByRole("button", { name: "List" })).toHaveAttribute("aria-pressed", "true");
    await pick("Rules");
    expect(where()).toBe("/a/hub-1/backlogs/ready/rulebook?kind=rule");
  });

  it("All issues keeps flipping the view in place on List and Board", async () => {
    issuesAt("/a/hub-1/backlogs/all");
    await screen.findByText("First thing");
    await waitFor(() => expect(choices()).toEqual(rulebookChoices));
    await pick("List");
    expect(screen.getByRole("button", { name: "List" })).toHaveAttribute("aria-pressed", "true");
  });
});
