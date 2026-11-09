import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { openAgency } from "../agency/open";
import * as mcp from "../wakala/mcp";
import { BacklogsPage } from "./BacklogsPage";
import { BacklogsRoutes } from "./BacklogsRoutes";
import { issuePath, issuesPath } from "./paths";
import { allIssuesId, hubBacklogsOf, issueOf, listCap, mcpBacklogsClient, stepsOf, taskTools } from "./api";
import { countWords, tagsOf, toggled, withAllTags } from "./tags";

const hub = "hub-1";

const task = (id: string, title: string, rank: number, extra: Record<string, unknown> = {}) => ({
  id,
  title,
  rank,
  status: "pending",
  state: "To do",
  project_name: "hub-steward",
  tags: [],
  ...extra,
});

const board = [
  task("t3", "Record the voice clips", 3, { project_name: "community-hubs" }),
  task("t1", "Fix mirrored board drift", 1, { project_name: "mwanachama-web", tags: ["Docs"] }),
  task("t2", "Import the municipality", 2, { status: "blocked", state: "Waiting", description: "Load the English template." }),
];

const stepNames = ["To do", "Doing", "Waiting", "Done", "Cancelled"];

const hubBacklogs = (tasks: unknown[]) => ({
  items: [
    {
      id: "backlog",
      name: "Backlog",
      issues: tasks.length,
      steps: stepNames.map((name) => ({ id: name.toLowerCase().replace(" ", "-"), name, issues: 0 })),
    },
  ],
});

const answering = (tasks: unknown[]) =>
  vi.spyOn(mcp, "callTool").mockImplementation((async (_hub: string, tool: string, args: Record<string, unknown> = {}) => {
    switch (tool) {
      case taskTools.list:
        return { items: tasks };
      case taskTools.backlogs:
        return hubBacklogs(tasks);
      case taskTools.get:
        return tasks.find((one: any) => one.id === args.taskID);
      case taskTools.edges:
        return { items: args.vertex_id === "t2" ? [{ from_id: "t2", to_id: "t1", label: "depends_on" }] : [] };
      case "agency_get_agency":
        return { id: hub, name: "Hub Steward SWE" };
      default:
        return { items: [], modules: [] };
    }
  }) as never);

const Where = () => {
  const at = useLocation();
  return <span data-testid="where">{at.pathname + at.search}</span>;
};

const openAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/a/:agencyId/backlogs/*" element={<BacklogsRoutes />} />
      </Routes>
      <Where />
    </MemoryRouter>,
  );

const titles = () => Array.from(document.querySelectorAll(".issue-row .open")).map((one) => one.textContent);

const where = () => screen.getByTestId("where").textContent;

beforeEach(() => {
  openAgency(hub);
});

describe("the Backlogs screen", () => {
  it("lists All issues and the backlog with its steps and issues", async () => {
    answering(board);
    openAt("/a/hub-1/backlogs");
    expect(await screen.findByText("All issues")).toBeInTheDocument();
    expect(screen.getByText("3 issues")).toBeInTheDocument();
    expect(screen.getByText("5 steps · 3 issues")).toBeInTheDocument();
    expect(await screen.findByText("Hub Steward SWE")).toBeInTheDocument();
  });

  it("opens the board of one backlog from its row", async () => {
    answering(board);
    openAt("/a/hub-1/backlogs");
    await userEvent.click(await screen.findByText("5 steps · 3 issues"));
    expect(where()).toBe("/a/hub-1/backlogs/backlog/board");
  });

  it("opens the list of every issue from the All issues row", async () => {
    answering(board);
    openAt("/a/hub-1/backlogs");
    await userEvent.click(await screen.findByText("3 issues"));
    expect(where()).toBe("/a/hub-1/backlogs/all");
  });

  it("shows Add a backlog only to a role that may manage backlogs", async () => {
    answering(board);
    const may = (allowed: boolean) => ({ mayManage: async () => allowed }) as never;
    const { unmount } = render(
      <MemoryRouter initialEntries={["/a/hub-1/backlogs"]}>
        <BacklogsPage client={{ backlogs: async () => [], issues: async () => [], issue: async () => ({}) as never }} manage={may(true)} />
        <Where />
      </MemoryRouter>,
    );
    await userEvent.click(await screen.findByRole("button", { name: "Add a backlog" }));
    expect(where()).toBe("/a/hub-1/backlogs/new");
    unmount();
    render(
      <MemoryRouter initialEntries={["/a/hub-1/backlogs"]}>
        <BacklogsPage manage={may(false)} />
      </MemoryRouter>,
    );
    await screen.findByText("3 issues");
    expect(screen.queryByRole("button", { name: "Add a backlog" })).not.toBeInTheDocument();
  });

  it("shows the empty card with an Open Chat button before the first load", async () => {
    answering([]);
    openAt("/a/hub-1/backlogs");
    expect(await screen.findByText("No backlog yet")).toBeInTheDocument();
    expect(screen.getByText("Ask in Chat to load the boards")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Chat" })).toBeInTheDocument();
  });

  it("says so when the backlogs cannot be read", async () => {
    vi.spyOn(mcp, "callTool").mockRejectedValue(new Error("down"));
    openAt("/a/hub-1/backlogs");
    expect(await screen.findByRole("alert")).toHaveTextContent("The backlogs could not be loaded.");
  });
});

describe("the list of issues", () => {
  it("shows the issues in rank order with the mark, repo, topic and backlog as tags", async () => {
    answering(board);
    openAt("/a/hub-1/backlogs/all");
    await screen.findByText("Fix mirrored board drift");
    expect(titles()).toEqual(["Fix mirrored board drift", "Import the municipality", "Record the voice clips"]);
    const first = document.querySelector(".issue-row") as HTMLElement;
    expect(within(first).getAllByRole("button").slice(1).map((one) => one.textContent)).toEqual(["Ready", "mwanachama-web", "Docs", "Backlog"]);
    expect(screen.getByText("3 issues")).toBeInTheDocument();
  });

  it("filters to a tapped tag and clears it from the chosen chips", async () => {
    answering(board);
    openAt("/a/hub-1/backlogs/all");
    await screen.findByText("Fix mirrored board drift");
    await userEvent.click(within(document.querySelector(".issue-row") as HTMLElement).getByRole("button", { name: "Docs" }));
    expect(titles()).toEqual(["Fix mirrored board drift"]);
    expect(screen.getByText("1 issue of 3")).toBeInTheDocument();
    expect(where()).toBe("/a/hub-1/backlogs/all?tag=Docs");
    await userEvent.click(screen.getByRole("button", { name: "Docs ✕" }));
    expect(titles()).toHaveLength(3);
    expect(where()).toBe("/a/hub-1/backlogs/all");
  });

  it("narrows by tags chosen together and says when none match", async () => {
    answering(board);
    openAt(issuesPath("all", ["Docs", "Blocked"]));
    expect(await screen.findByText("No issues have all of those tags.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Blocked ✕" }));
    expect(titles()).toEqual(["Fix mirrored board drift"]);
  });

  it("starts with the tags a chat card asked for", async () => {
    answering(board);
    openAt("/a/hub-1/backlogs/backlog?tag=Blocked");
    await screen.findByText("Import the municipality");
    expect(titles()).toEqual(["Import the municipality"]);
    expect(screen.getByRole("heading", { name: "Backlog" })).toBeInTheDocument();
  });

  it("shows the empty card when nothing is loaded", async () => {
    answering([]);
    openAt("/a/hub-1/backlogs/all");
    expect(await screen.findByText("No issues yet. Ask in Chat to load the boards.")).toBeInTheDocument();
  });

  it("has a List | Board switch on a backlog's list that keeps the chosen tags", async () => {
    answering(board);
    openAt("/a/hub-1/backlogs/backlog?tag=Blocked");
    await userEvent.click(await screen.findByRole("button", { name: "Board" }));
    expect(where()).toBe("/a/hub-1/backlogs/backlog/board?tag=Blocked");
  });

  it("has no List | Board switch on All issues", async () => {
    answering(board);
    openAt("/a/hub-1/backlogs/all");
    await screen.findByText("Fix mirrored board drift");
    expect(screen.queryByRole("button", { name: "Board" })).not.toBeInTheDocument();
  });

  it("opens an issue from its title", async () => {
    answering(board);
    openAt("/a/hub-1/backlogs/all");
    await userEvent.click(await screen.findByRole("button", { name: "Import the municipality" }));
    expect(where()).toBe(issuePath("t2"));
  });
});

describe("one issue", () => {
  it("shows its backlog and step, its description and what it waits on", async () => {
    answering(board);
    openAt(issuePath("t2"));
    expect(await screen.findByText("Backlog · Waiting")).toBeInTheDocument();
    expect(screen.getByText("Load the English template.")).toBeInTheDocument();
    expect(screen.getByText("Waits on")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Fix mirrored board drift/ }));
    await waitFor(() => expect(where()).toBe(issuePath("t1")));
  });

  it("shows no Waits on heading for an issue that waits on nothing", async () => {
    answering(board);
    openAt(issuePath("t1"));
    await screen.findByText("Backlog · To do");
    expect(screen.queryByText("Waits on")).not.toBeInTheDocument();
  });
});

describe("reading the task module's answers", () => {
  it("marks settled work with no tag and blocked work Blocked", () => {
    expect(issueOf({ id: "a", status: "completed" }).mark).toBe("");
    expect(issueOf({ id: "a", status: "blocked" }).mark).toBe("Blocked");
    expect(issueOf({ id: "a", status: "in_progress" }).mark).toBe("Ready");
  });

  it("sends unranked issues to the end", () => {
    expect(issueOf({ id: "a", rank: 0 }).rank).toBeGreaterThan(issueOf({ id: "b", rank: 5 }).rank);
  });

  it("reads step names from a list or from items", () => {
    expect(stepsOf([{ name: "To do" }, { name: "" }])).toEqual(["To do"]);
    expect(stepsOf({ items: [{ name: "Doing" }] })).toEqual(["Doing"]);
  });

  it("builds tags without repeats and toggles them", () => {
    const issue = issueOf({ id: "a", project_name: "Docs", tags: ["Docs", "Writing"], status: "pending" }, hubBacklogsOf(hubBacklogs([])));
    expect(tagsOf(issue)).toEqual(["Ready", "Docs", "Writing", "Backlog"]);
    expect(withAllTags([issue], ["Docs", "Writing"])).toHaveLength(1);
    expect(withAllTags([issue], ["Missing"])).toHaveLength(0);
    expect(toggled(["a"], "b")).toEqual(["a", "b"]);
    expect(toggled(["a", "b"], "a")).toEqual(["b"]);
    expect(countWords(1, 3, true)).toBe("1 issue of 3");
    expect(countWords(2, 2, false)).toBe("2 issues");
  });
});

describe("talking to the hub", () => {
  const actions = () => {
    const operations = JSON.parse(readFileSync(resolve(process.cwd(), "../wakala-api/modules/taskmanager/taskmanager.operations.json"), "utf8"));
    return new Set<string>(Object.values<any>(operations.operations ?? operations).map((one) => String(one.action).replaceAll(".", "_")));
  };

  it("calls only tools the task module declares", () => {
    const declared = actions();
    for (const tool of Object.values(taskTools)) expect(declared.has(tool), tool).toBe(true);
  });

  it("asks for the issues of one backlog by its id and for all of them with no backlog", async () => {
    const call = answering(board);
    await mcpBacklogsClient.issues("backlog");
    await mcpBacklogsClient.issues(allIssuesId);
    const lists = call.mock.calls.filter((one) => one[1] === taskTools.list).map((one) => one[2]);
    expect(lists).toEqual([{ backlog: "backlog", limit: listCap }, { limit: listCap }]);
  });

  it("takes the backlogs, their steps and their counts from the hub", async () => {
    answering(board);
    expect(await mcpBacklogsClient.backlogs()).toEqual([{ id: "backlog", name: "Backlog", steps: stepNames, issues: 3 }]);
  });

  it("reads the backlog and step an issue is placed in, by id", () => {
    const hub = hubBacklogsOf({
      items: [
        { id: "backlog", name: "Backlog", steps: [{ id: "to-do", name: "To do", issues: 1 }] },
        { id: "software", name: "Software", steps: [{ id: "idea", name: "Idea", issues: 0 }] },
      ],
    });
    const placed = issueOf({ id: "a", backlog: "software", step: "idea", state: "To do" }, hub);
    expect([placed.backlog, placed.step]).toEqual(["Software", "Idea"]);
    const unplaced = issueOf({ id: "b", step: "to-do" }, hub);
    expect([unplaced.backlog, unplaced.step]).toEqual(["Backlog", "To do"]);
  });

  it("shows one Ready or Blocked chip, the loader's own tag first", () => {
    const issue = issueOf({ id: "a", status: "pending", tags: ["Blocked", "Docs"] });
    expect(issue.mark).toBe("Blocked");
    expect(tagsOf(issue).filter((tag) => tag === "Ready" || tag === "Blocked")).toEqual(["Blocked"]);
    expect(issueOf({ id: "b", status: "in_progress", tags: ["Ready", "Blocked"] }).mark).toBe("Blocked");
    expect(issueOf({ id: "c", status: "completed", tags: ["Ready"] }).mark).toBe("");
  });
});
