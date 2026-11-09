import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { openAgency } from "../agency/open";
import * as mcp from "../wakala/mcp";
import { BacklogsPage } from "./BacklogsPage";
import { mayReadIn, noRoleWords, nothingSharedWords } from "./access";
import { BacklogsRoutes } from "./BacklogsRoutes";
import { NeedsRole } from "./NeedsRole";
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

const titles = () => Array.from(document.querySelectorAll(".issue-row .issue-title")).map((one) => one.textContent);

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

  it("shows the empty card, with no Open Chat button, before the first load", async () => {
    answering([]);
    openAt("/a/hub-1/backlogs");
    expect(await screen.findByText("No backlog yet")).toBeInTheDocument();
    expect(screen.getByText("Run the loader on your laptop to load the boards")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open Chat" })).not.toBeInTheDocument();
  });

  it("says so when the backlogs cannot be read", async () => {
    vi.spyOn(mcp, "callTool").mockRejectedValue(new Error("down"));
    openAt("/a/hub-1/backlogs");
    expect(await screen.findByRole("alert")).toHaveTextContent("The backlogs could not be loaded.");
  });
});

describe("the list of issues", () => {
  it("shows the issues in rank order with the title and the tags as bubbles on each row", async () => {
    answering(board);
    openAt("/a/hub-1/backlogs/all");
    await screen.findByText("Fix mirrored board drift");
    expect(titles()).toEqual(["Fix mirrored board drift", "Import the municipality", "Record the voice clips"]);
    const first = document.querySelector(".issue-row") as HTMLElement;
    expect(within(first).getAllByRole("button")).toHaveLength(5);
    expect(first.querySelector(".issue-title")?.textContent).toBe("Fix mirrored board drift");
    expect(Array.from(first.querySelectorAll(".chip")).map((one) => one.textContent)).toEqual(["Ready", "mwanachama-web", "Docs", "Backlog"]);
    expect(screen.getByText("3 issues")).toBeInTheDocument();
  });

  it("keeps a long title to two lines and gives the description only to the detail page", async () => {
    const long = "DEV-009 Create the party plane's structure tables";
    answering([task("t9", long, 1, { description: "A paragraph that belongs on the detail page only." })]);
    openAt("/a/hub-1/backlogs/all");
    await screen.findByRole("button", { name: new RegExp(`^${long}`) });
    expect(screen.queryByText("A paragraph that belongs on the detail page only.")).not.toBeInTheDocument();
    expect(document.querySelector(".issue-row .issue-title")?.textContent).toBe(long);
    await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${long}`) }));
    expect(await screen.findByText("A paragraph that belongs on the detail page only.")).toBeInTheDocument();
  });

  it("draws the pills of the issue's page and of its Waits-on rows as plain pills that do nothing", async () => {
    answering(board);
    openAt(issuePath("t2"));
    await screen.findByText("Waits on");
    const top = document.querySelector(".issue-row.static") as HTMLElement;
    const pill = within(top).getByText("Blocked");
    expect(pill.tagName).toBe("SPAN");
    await userEvent.click(pill);
    expect(where()).toBe(issuePath("t2"));
    const waited = (document.querySelector(".card.flush .rows .issue-row") as HTMLElement).querySelector(".chip") as HTMLElement;
    expect(waited.tagName).toBe("SPAN");
    await userEvent.click(waited);
    await waitFor(() => expect(where()).toBe(issuePath("t1")));
  });

  it("adds a tapped bubble to the filter without opening the issue, and a chosen bubble is selected and removes itself", async () => {
    answering(board);
    openAt("/a/hub-1/backlogs/all");
    await screen.findByText("Fix mirrored board drift");
    const bubble = (name: string) => within(document.querySelector(".issue-row") as HTMLElement).getByRole("button", { name });
    await userEvent.click(bubble("Ready"));
    expect(where()).toBe("/a/hub-1/backlogs/all?tag=Ready");
    await userEvent.click(bubble("Docs"));
    expect(where()).toBe("/a/hub-1/backlogs/all?tag=Ready&tag=Docs");
    expect(titles()).toEqual(["Fix mirrored board drift"]);
    expect(bubble("Docs")).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(bubble("Docs"));
    expect(where()).toBe("/a/hub-1/backlogs/all?tag=Ready");
    expect(bubble("Docs")).toHaveAttribute("aria-pressed", "false");
  });

  it("opens the issue from a tap on the row but not from a tap on a bubble", async () => {
    answering(board);
    openAt("/a/hub-1/backlogs/all");
    await screen.findByText("Fix mirrored board drift");
    const row = document.querySelector(".issue-row") as HTMLElement;
    await userEvent.click(within(row).getByRole("button", { name: "Docs" }));
    expect(where()).not.toContain("/issue/");
    await userEvent.click(document.querySelector(".issue-row") as HTMLElement);
    expect(where()).toContain("/issue/");
  });

  it("finds an issue by every word typed in its code, title or tags, but not its description", async () => {
    answering(board);
    openAt("/a/hub-1/backlogs/all");
    await screen.findByText("Fix mirrored board drift");
    const box = screen.getByRole("searchbox", { name: "Search issues" });
    await userEvent.type(box, "MUNICIPALITY");
    expect(titles()).toEqual(["Import the municipality"]);
    expect(screen.getByText("1 of 3 issues")).toBeInTheDocument();
    expect(where()).toBe("/a/hub-1/backlogs/all?q=MUNICIPALITY");
    await userEvent.clear(box);
    await userEvent.type(box, "import muni");
    expect(titles()).toEqual(["Import the municipality"]);
    await userEvent.clear(box);
    await userEvent.type(box, "import drift");
    expect(screen.getByText("No issues match")).toBeInTheDocument();
    await userEvent.clear(box);
    await userEvent.type(box, "Load the English");
    expect(screen.getByText("No issues match")).toBeInTheDocument();
  });

  it("finds a row by its repo tag, by Blocked, and by words that fall across the title and a tag", async () => {
    answering(board);
    openAt("/a/hub-1/backlogs/all");
    await screen.findByText("Fix mirrored board drift");
    const box = screen.getByRole("searchbox", { name: "Search issues" });
    await userEvent.type(box, "mwanachama-web");
    expect(titles()).toEqual(["Fix mirrored board drift"]);
    await userEvent.clear(box);
    await userEvent.type(box, "blocked");
    expect(titles()).toEqual(["Import the municipality"]);
    await userEvent.clear(box);
    await userEvent.type(box, "mirrored docs");
    expect(titles()).toEqual(["Fix mirrored board drift"]);
  });

  it("keeps the search, the count and the chosen tags in one filter bar pinned under the header", async () => {
    answering(board);
    openAt("/a/hub-1/backlogs/all?tag=Docs");
    await screen.findByText("Fix mirrored board drift");
    const bar = document.querySelector(".filter-bar") as HTMLElement;
    expect(within(bar).getByRole("searchbox", { name: "Search issues" })).toBeInTheDocument();
    expect(within(bar).getByText("1 of 3 issues")).toBeInTheDocument();
    expect(within(bar).getByRole("button", { name: "Docs ✕" })).toBeInTheDocument();
    const css = readFileSync(resolve(__dirname, "backlogs.css"), "utf8");
    expect(css).toMatch(/\.filter-bar \{[^}]*position: sticky;[^}]*top: 3rem;[^}]*background: var\(--bg\)/);
  });

  it("combines the search with the chosen tags, and the clear button restores the full list", async () => {
    answering(board);
    openAt("/a/hub-1/backlogs/all?tag=Docs");
    await screen.findByText("Fix mirrored board drift");
    expect(titles()).toEqual(["Fix mirrored board drift"]);
    await userEvent.type(screen.getByRole("searchbox", { name: "Search issues" }), "municipality");
    expect(screen.getByText("No issues match")).toBeInTheDocument();
    expect(where()).toBe("/a/hub-1/backlogs/all?tag=Docs&q=municipality");
    await userEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(titles()).toEqual(["Fix mirrored board drift"]);
    await userEvent.click(screen.getByRole("button", { name: "Docs ✕" }));
    expect(titles()).toHaveLength(3);
    expect(screen.queryByRole("button", { name: "Clear search" })).not.toBeInTheDocument();
  });

  it("keeps the search in the address when a tag is chosen and the tags when the search changes", async () => {
    answering(board);
    openAt("/a/hub-1/backlogs/all?q=the");
    await screen.findByText("Import the municipality");
    await userEvent.click(within(document.querySelector(".issue-row") as HTMLElement).getByRole("button", { name: "Blocked" }));
    expect(where()).toBe("/a/hub-1/backlogs/all?tag=Blocked&q=the");
  });

  it("narrows by tags chosen together and says when none match", async () => {
    answering(board);
    openAt(issuesPath("all", ["Docs", "Blocked"]));
    expect(await screen.findByText("No issues match")).toBeInTheDocument();
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
    expect(await screen.findByText("No issues yet. Run the loader on your laptop to load the boards.")).toBeInTheDocument();
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
    await userEvent.click(await screen.findByRole("button", { name: /^Import the municipality/ }));
    expect(where()).toBe(issuePath("t2"));
  });
});

describe("one issue", () => {
  it("opens on its title, code first, with its tags, the description without markdown marks and the source apart", async () => {
    answering([
      task("t9", "DEV-009 Create the party plane's tables", 1, {
        tags: ["Docs"],
        description: "Make **three** tables like `chapter`.\n- first\n- second\n\nRead from mwanachama-backend/todo.md\nAlso on the boards of: mwanachama-web",
      }),
    ]);
    openAt(issuePath("t9"));
    await screen.findByText("Docs");
    const top = document.querySelector(".issue-row.static") as HTMLElement;
    expect(top).toHaveTextContent("DEV-009 Create the party plane's tables");
    expect(top.querySelector(".issue-code")?.textContent).toBe("DEV-009");
    expect(top.closest(".card")).not.toBeNull();
    expect(within(top).queryByRole("link")).toBeNull();
    expect(top.querySelector(".open")?.tagName).toBe("SPAN");
    expect(Array.from(top.querySelectorAll(".chip")).map((one) => one.textContent)).toEqual(expect.arrayContaining(["Docs", "Backlog · To do"]));
    expect(within(screen.getByRole("banner")).getByRole("heading", { level: 1 })).toHaveTextContent("DEV-009");
    expect(screen.queryByRole("button", { name: "Docs" })).toBeNull();
    const detailTags = Array.from(document.querySelectorAll(".issue-row.static .issue-tags > *"));
    expect(detailTags.length).toBeGreaterThan(1);
    expect(detailTags.every((one) => one.classList.contains("chip"))).toBe(true);
    const text = document.body.textContent ?? "";
    expect(text).not.toContain("**");
    expect(text).not.toContain("`");
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Source" })).toHaveAttribute("aria-expanded", "true");
    expect(document.querySelector(".issue-body")?.textContent).not.toContain("Read from");
    expect(document.querySelector(".issue-source")?.textContent).toContain("Also on the boards of: mwanachama-web");
  });

  it("shows its tags, its backlog and step, its description and what it waits on", async () => {
    answering(board);
    openAt(issuePath("t2"));
    expect(await screen.findByText("Backlog · Waiting")).toBeInTheDocument();
    expect(screen.getByText("Load the English template.")).toBeInTheDocument();
    expect(screen.getByText("Waits on")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Fix mirrored board drift/ }));
    await waitFor(() => expect(where()).toBe(issuePath("t1")));
  });

  it("lists what it waits on as rows of one card, the same row as the lists, and a row opens its issue", async () => {
    answering(board);
    openAt(issuePath("t2"));
    await screen.findByText("Waits on");
    const card = screen.getByText("Waits on").closest("section")?.querySelector(".rows") as HTMLElement;
    expect(card.querySelectorAll(".issue-row")).toHaveLength(1);
    expect(card.querySelector(".end")).toHaveTextContent("›");
    await userEvent.click(within(card).getByRole("button", { name: /Fix mirrored board drift/ }));
    await waitFor(() => expect(where()).toBe(issuePath("t1")));
  });

  it("makes Waits on the header of the card that holds its rows, and collapses them when the header is tapped", async () => {
    answering(board);
    openAt(issuePath("t2"));
    const head = await screen.findByRole("button", { name: "Waits on" });
    const card = head.closest("section") as HTMLElement;
    expect(card).toHaveClass("card");
    expect(head).toHaveAttribute("aria-expanded", "true");
    expect(card.querySelectorAll(".issue-row")).toHaveLength(1);
    expect(screen.queryByRole("heading", { name: "Waits on" })).toBeNull();
    await userEvent.click(head);
    expect(head).toHaveAttribute("aria-expanded", "false");
    expect(card.querySelectorAll(".issue-row")).toHaveLength(0);
    await userEvent.click(head);
    await userEvent.click(within(card).getByRole("button", { name: /Fix mirrored board drift/ }));
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

  it("leaves an issue the hub placed at no step with no step, not at the state's name", () => {
    const hub = hubBacklogsOf({ items: [{ id: "backlog", name: "Backlog", steps: [{ id: "to-do", name: "To do", issues: 1 }] }] });
    expect(issueOf({ id: "a", backlog: "backlog", state: "To do" }, hub).step).toBe("");
    expect(issueOf({ id: "b", state: "To do" }, hub).step).toBe("To do");
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
    expect(countWords(1, 3, true)).toBe("1 of 3 issues");
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

  const pagedHub = (total: number, atNoStep = 0) => {
    const all = Array.from({ length: total }, (_, at) => ({
      id: `t${at}`,
      title: `Issue ${at}`,
      rank: at + 1,
      status: "pending",
      state: "To do",
      backlog: "backlog",
      step: at < atNoStep ? "" : at % 5 < 3 ? "to-do" : "doing",
      priority: ["critical", "high", "medium", "low"][at % 4],
      project_name: "hub-steward",
      tags: at % 100 === 0 ? ["Docs"] : [],
    }));
    return vi.spyOn(mcp, "callTool").mockImplementation((async (_hub: string, tool: string, args: Record<string, unknown> = {}) => {
      if (tool === taskTools.backlogs) {
        const steps = ["to-do", "doing"].map((id) => ({ id, name: id, issues: all.filter((one) => one.step === id).length }));
        return { items: [{ id: "backlog", name: "Backlog", issues: all.length, steps }] };
      }
      if (tool !== taskTools.list) return { items: [] };
      const from = Number(args.offset ?? 0);
      return { items: all.slice(from, from + Math.min(Number(args.limit ?? 500), 500)) };
    }) as never);
  };

  const listCalls = (call: ReturnType<typeof pagedHub>) => call.mock.calls.filter((one) => one[1] === taskTools.list).map((one) => one[2] as Record<string, unknown>);

  it("loads every issue past the hub's 500-row page by asking for the next pages", async () => {
    const call = pagedHub(1400);
    const issues = await mcpBacklogsClient.issues(allIssuesId);
    expect(issues).toHaveLength(1400);
    expect(new Set(issues.map((one) => one.id)).size).toBe(1400);
    expect(listCalls(call).map((one) => one.offset)).toEqual([undefined, 500, 1000]);
    expect(issues.map((one) => one.rank)).toEqual([...issues.map((one) => one.rank)].sort((a, b) => a - b));
  });

  it("loads the issues at no step too, in the same pages", async () => {
    const call = pagedHub(1400, 100);
    const issues = await mcpBacklogsClient.issues("backlog");
    expect(issues).toHaveLength(1400);
    expect(issues.filter((one) => one.step === "")).toHaveLength(100);
    expect(listCalls(call)).toHaveLength(3);
  });

  it("asks once when everything fits in one page", async () => {
    const call = pagedHub(300);
    expect(await mcpBacklogsClient.issues("backlog")).toHaveLength(300);
    expect(listCalls(call)).toHaveLength(1);
  });

  it("stops when a hub that ignores offset sends the same page again", async () => {
    const first = Array.from({ length: 500 }, (_, at) => ({ id: `t${at}`, title: `Issue ${at}`, rank: at + 1, status: "pending", backlog: "backlog", tags: [] }));
    const call = vi.spyOn(mcp, "callTool").mockImplementation((async (_hub: string, tool: string) => (tool === taskTools.backlogs ? { items: [] } : { items: first })) as never);
    expect(await mcpBacklogsClient.issues(allIssuesId)).toHaveLength(500);
    expect(call.mock.calls.filter((one) => one[1] === taskTools.list)).toHaveLength(2);
  });

  it("fails the whole list when one page fails", async () => {
    pagedHub(1400);
    const inner = vi.mocked(mcp.callTool).getMockImplementation() as (...args: any[]) => Promise<unknown>;
    vi.spyOn(mcp, "callTool").mockImplementation((async (hub: string, tool: string, args: Record<string, unknown> = {}) => {
      if (tool === taskTools.list && args.offset === 500) throw new Error("page failed");
      return inner(hub, tool, args);
    }) as never);
    await expect(mcpBacklogsClient.issues(allIssuesId)).rejects.toThrow("page failed");
  });

  it("filters by a tag across the whole set, not the first 500", async () => {
    pagedHub(1400);
    openAt("/a/hub-1/backlogs/all?tag=Docs");
    expect(await screen.findByText("14 of 1400 issues")).toBeInTheDocument();
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

describe("a member who holds no role, or whose group shares nothing", () => {
  const withRoles = (permissions: string[] | undefined, tasks: unknown[] = board, backlogs?: unknown) =>
    vi.spyOn(mcp, "callTool").mockImplementation((async (_hub: string, tool: string) => {
      switch (tool) {
        case "agency_get_my_roles":
          return permissions === undefined ? {} : { permissions };
        case taskTools.backlogs:
          return backlogs ?? hubBacklogs(tasks);
        case taskTools.list:
          return { items: tasks };
        case "agency_get_agency":
          return { id: hub, name: "Hub Steward SWE" };
        default:
          return { items: [] };
      }
    }) as never);

  it("says there is no access yet, once, when the member's roles hold no task.read", async () => {
    withRoles([]);
    openAt("/a/hub-1/backlogs");
    expect(await screen.findByText(noRoleWords)).toBeInTheDocument();
    expect(screen.queryByText("All issues")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("says the same on a link to a board, a list or an issue", async () => {
    withRoles(["chat.post"]);
    openAt("/a/hub-1/backlogs/backlog/board");
    expect(await screen.findByText(noRoleWords)).toBeInTheDocument();
  });

  it("opens the Backlogs for a member whose role holds task.read", async () => {
    withRoles(["task.read"]);
    openAt("/a/hub-1/backlogs");
    expect(await screen.findByText("All issues")).toBeInTheDocument();
    expect(screen.queryByText(noRoleWords)).not.toBeInTheDocument();
  });

  it("says no backlogs are shared yet when the hub shows a member none", async () => {
    withRoles(["task.read"], [], { items: [] });
    openAt("/a/hub-1/backlogs");
    expect(await screen.findByText(nothingSharedWords)).toBeInTheDocument();
    expect(screen.queryByText("All issues")).not.toBeInTheDocument();
    expect(screen.queryByText("No backlog yet")).not.toBeInTheDocument();
  });

  it("lets the screens speak when the roles cannot be read or carry no permission list", async () => {
    withRoles(undefined);
    openAt("/a/hub-1/backlogs");
    expect(await screen.findByText("All issues")).toBeInTheDocument();
    expect(mayReadIn({})).toBe(true);
    expect(mayReadIn({ permissions: ["task.read"] })).toBe(true);
    expect(mayReadIn({ permissions: [] })).toBe(false);
  });

  it("shows the screens when the roles read fails", async () => {
    vi.spyOn(mcp, "callTool").mockRejectedValue(new Error("down"));
    render(
      <MemoryRouter>
        <NeedsRole>
          <p>The screens</p>
        </NeedsRole>
      </MemoryRouter>,
    );
    expect(await screen.findByText("The screens")).toBeInTheDocument();
  });
});
