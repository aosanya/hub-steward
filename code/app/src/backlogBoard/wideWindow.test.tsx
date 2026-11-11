import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../agency/open";
import type { BacklogsClient, Issue } from "../backlogs/api";
import { IssuesPage } from "../backlogs/IssuesPage";
import { SmartBacklogPage } from "../smartBacklog/SmartBacklogPage";
import type { SmartBacklogClient } from "../smartBacklog/types";
import { Shell } from "../ui/Shell";
import { BacklogBoard } from "./BacklogBoard";

vi.mock("../wakala/mcp", async () => {
  const actual = await vi.importActual<typeof import("../wakala/mcp")>("../wakala/mcp");
  return { ...actual, callTool: async () => ({ items: [] }) };
});

beforeEach(() => openAgency("hub-1"));

afterEach(() => forgetOpenAgency());

const issue = (id: string, title: string, step: string): Issue => ({ id, backlogId: "backlog", title, description: "", status: "pending", step, repo: "hub-steward", topics: [], backlog: "Backlog", mark: "Ready", rank: 1 });

const issues = [issue("1", "Record the clips", "To do"), issue("2", "Fix the import route", "Doing")];

const client: BacklogsClient = {
  backlogs: async () => [{ id: "backlog", name: "Backlog", steps: ["To do", "Doing", "Waiting", "Done", "Cancelled"], issues: 2 }],
  issues: async () => issues,
  issue: async () => {
    throw new Error("unused");
  },
};

const smart: SmartBacklogClient = {
  choices: async () => ({ tag: [], mark: [], backlog: [], step: [], priority: [] }),
  count: async () => 2,
  create: async () => "x",
  read: async (id) => ({ id, name: "Ready to start", set: { match: "all", rules: [] }, issues: 2 }),
  update: async () => undefined,
  mayManage: async () => false,
  remove: async () => undefined,
};

const frame = () => document.querySelector(".frame");

const issuesAt = (at: string) =>
  render(
    <MemoryRouter initialEntries={[at]}>
      <Routes>
        <Route path="/a/hub-1/backlogs/:backlogId/issues" element={<IssuesPage client={client} manage={{ mayManage: async () => false } as never} smartBacklogs={async () => []} />} />
      </Routes>
    </MemoryRouter>,
  );

describe("the fluid frame", () => {
  it("is off on a screen that does not ask for it", () => {
    render(
      <MemoryRouter>
        <Shell title="Chat">
          <p>body</p>
        </Shell>
      </MemoryRouter>,
    );
    expect(frame()).not.toHaveClass("fluid");
  });

  it("is on when a screen asks for it", () => {
    render(
      <MemoryRouter>
        <Shell title="Chat" fluid>
          <p>body</p>
        </Shell>
      </MemoryRouter>,
    );
    expect(frame()).toHaveClass("fluid");
  });
});

describe("the backlog screens on a wide window", () => {
  it("lets All issues as a Board use the window", async () => {
    issuesAt("/a/hub-1/backlogs/all/issues");
    await screen.findByRole("region", { name: "To do" });
    expect(frame()).toHaveClass("fluid");
    expect(screen.getByRole("searchbox", { name: "Search issues" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "View" })).toBeInTheDocument();
  });

  it("lets All issues as a List use the window", async () => {
    issuesAt("/a/hub-1/backlogs/all/issues?view=list");
    await screen.findByText("Record the clips");
    expect(frame()).toHaveClass("fluid");
    expect(screen.getByRole("searchbox", { name: "Search issues" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "View" })).toBeInTheDocument();
  });

  it("lets a backlog's Board use the window", async () => {
    render(
      <MemoryRouter initialEntries={["/a/hub-1/backlogs/backlog/board"]}>
        <Routes>
          <Route path="/a/hub-1/backlogs/:backlogId/board" element={<BacklogBoard client={client} />} />
        </Routes>
      </MemoryRouter>,
    );
    await screen.findByRole("region", { name: "To do" });
    expect(frame()).toHaveClass("fluid");
    expect(screen.getByRole("searchbox", { name: "Search issues" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "View" })).toBeInTheDocument();
  });

  it.each([["board", "/a/hub-1/backlogs/ready/smart"], ["list", "/a/hub-1/backlogs/ready/smart?view=list"]])("lets a smart backlog as a %s use the window with the switch on its own", async (_view, at) => {
    render(
      <MemoryRouter initialEntries={[at]}>
        <Routes>
          <Route path="/a/hub-1/backlogs/:backlogId/smart" element={<SmartBacklogPage client={smart} issues={client} manage={{ mayManage: async () => false } as never} />} />
        </Routes>
      </MemoryRouter>,
    );
    await screen.findByRole("group", { name: "View" });
    expect(frame()).toHaveClass("fluid");
    expect(screen.queryByRole("searchbox")).toBeNull();
  });
});

const frameCss = readFileSync(resolve(__dirname, "../ui/drawerFrame.css"), "utf8");

const wideBlock = () => frameCss.slice(frameCss.indexOf("@media (min-width: 48rem)"));

describe("the header line on a wide window", () => {
  it("is set only inside one min-width media block, so a phone keeps its stacked header", () => {
    expect(frameCss).toContain("@media (min-width: 48rem)");
    const outside = frameCss.slice(0, frameCss.indexOf("@media (min-width: 48rem)"));
    expect(outside).not.toContain("display: contents");
  });

  it("dissolves the headline row and sends Actions to the right end of the line", () => {
    const block = wideBlock();
    expect(block).toMatch(/\.frame\.fluid \.head(-line)?[^{]*\{[^}]*display: contents/);
    expect(block).toMatch(/\.frame\.fluid \.actions\s*\{[^}]*margin-left: auto/);
  });

  it("keeps the line in order: title, then Search or the Smart chip and rule, then the count, then the switch, then Actions, with the board after", () => {
    const block = wideBlock();
    expect(block).toMatch(/\.frame\.fluid \.body > \*\s*\{[^}]*order: 3/);
    expect(block).toMatch(/\.frame\.fluid \.body > \.count\s*\{[^}]*order: 1[^}]*margin-left: auto/);
    expect(block).toMatch(/\.frame\.fluid \.body > \.seg\s*\{[^}]*order: 1/);
    expect(block).toMatch(/\.frame\.fluid \.actions\s*\{[^}]*order: 2/);
  });

  it("sizes the List | Board switch to its content on that line", () => {
    expect(wideBlock()).toMatch(/\.frame\.fluid \.body > \.seg\s*\{[^}]*flex: 0 0 auto/);
  });

  it("puts the count on the search line, after the Search box, with no row of its own", () => {
    expect(wideBlock()).toMatch(/\.frame\.fluid \.filter-bar\s*\{[^}]*flex-direction: row/);
    expect(wideBlock()).toMatch(/\.frame\.fluid \.filter-bar > \.sub\s*\{[^}]*flex: none/);
    expect(wideBlock()).toMatch(/\.frame\.fluid \.filter-bar > \.search-box\s*\{[^}]*flex: 1 1 18rem/);
  });
});
