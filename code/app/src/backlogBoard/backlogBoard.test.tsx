import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import type { Backlog, BacklogsClient, Issue } from "../backlogs/api";
import { BacklogBoard } from "./BacklogBoard";
import { tagsOf, withAllTags } from "../backlogs/tags";
import { columnsOf, unplacedStep } from "./board";

const issue = (id: string, title: string, step: string, over: Partial<Issue> = {}): Issue => ({
  id,
  title,
  description: "",
  status: "pending",
  step,
  repo: "hub-steward",
  topics: [],
  backlog: "Backlog",
  mark: "Ready",
  rank: 1,
  ...over,
});

const issues = [
  issue("1", "Record the clips", "To do", { repo: "community-hubs" }),
  issue("2", "Fix the import route", "Doing"),
  issue("3", "Import the municipality", "Waiting", { mark: "Blocked", topics: ["Docs"] }),
];

const backlog: Backlog = { id: "default", name: "Software", steps: ["To do", "Doing", "Waiting", "Done"], issues: 3 };

const client = (over: Partial<BacklogsClient> = {}): BacklogsClient => ({
  backlogs: async () => [backlog],
  issues: async () => issues,
  issue: async () => {
    throw new Error("unused");
  },
  ...over,
});

function Where() {
  const place = useLocation();
  return <p data-testid="where">{place.pathname + place.search}</p>;
}

const open = (c: BacklogsClient, at = "/a/x/backlogs/default/board") =>
  render(
    <MemoryRouter initialEntries={[at]}>
      <Routes>
        <Route path="/a/x/backlogs/:backlogId/board" element={<BacklogBoard client={c} />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );

const column = (name: string) => screen.getByRole("region", { name });

describe("board columns", () => {
  it("makes one column per step and puts an issue with an unknown step in an Unplaced column", () => {
    const columns = columnsOf(["To do", "Done"], [issue("1", "A", "To do"), issue("2", "B", "Review")]);
    expect(columns.map((c) => [c.step, c.issues.map((i) => i.id)])).toEqual([["To do", ["1"]], ["Done", []], [unplacedStep, ["2"]]]);
  });

  it("puts an issue at no step in Unplaced, as the hub leaves it, never in the first column", () => {
    const columns = columnsOf(["To do", "Done"], [issue("1", "A", "")]);
    expect(columns.map((c) => [c.step, c.issues.map((i) => i.id)])).toEqual([["To do", []], ["Done", []], [unplacedStep, ["1"]]]);
  });

  it("adds no Unplaced column when every issue sits at a step", () => {
    expect(columnsOf(["To do"], [issue("1", "A", "To do")]).map((c) => c.step)).toEqual(["To do"]);
  });

  it("filters to the issues that carry every chosen tag", () => {
    expect(withAllTags(issues, ["Blocked", "Docs"]).map((i) => i.id)).toEqual(["3"]);
    expect(withAllTags(issues, [])).toHaveLength(3);
    expect(tagsOf(issues[2])).toEqual(["Blocked", "hub-steward", "Docs", "Backlog"]);
  });
});

describe("BacklogBoard", () => {
  it("draws a column for each step with its issues and the counts", async () => {
    open(client());
    expect(await screen.findByRole("heading", { level: 1, name: "Software" })).toBeInTheDocument();
    expect(screen.getByText("3 issues · 4 steps")).toBeInTheDocument();
    expect(within(column("To do")).getByText("Record the clips")).toBeInTheDocument();
    expect(within(column("Waiting")).getByText("Import the municipality")).toBeInTheDocument();
    expect(within(column("Done")).getByText("Nothing here")).toBeInTheDocument();
  });

  it("shows the title and the tags as bubbles on a card and opens the issue when it is tapped", async () => {
    const user = userEvent.setup();
    open(client());
    await screen.findByText("Record the clips");
    const card = within(column("Waiting")).getByRole("button", { name: /^Import the municipality/ });
    expect(card.querySelector(".issue-title")?.textContent).toBe("Import the municipality");
    expect(Array.from(card.querySelectorAll(".chip")).map((one) => one.textContent)).toEqual(["Blocked", "hub-steward", "Docs", "Backlog"]);
    expect(within(column("To do")).getByRole("button", { name: /Record the clips/ }).querySelectorAll(".chip")).toHaveLength(3);
    await user.click(card);
    await waitFor(() => expect(screen.getByTestId("where").textContent).toMatch(/\/backlogs\/issue\/3$/));
  });

  it("filters every column by the tags in the address and clears them again", async () => {
    const user = userEvent.setup();
    open(client(), "/a/x/backlogs/default/board?tag=Docs");
    await screen.findByText("Import the municipality");
    expect(screen.queryByText("Record the clips")).not.toBeInTheDocument();
    expect(screen.getByText("1 issue · 4 steps")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(await screen.findByText("Record the clips")).toBeInTheDocument();
  });

  it("opens the list of this backlog from the List switch and keeps the chosen tags", async () => {
    const user = userEvent.setup();
    open(client(), "/a/x/backlogs/default/board?tag=Ready");
    await screen.findByText("Record the clips");
    await user.click(screen.getByRole("button", { name: "List" }));
    await waitFor(() => expect(screen.getByTestId("where").textContent).toMatch(/\/backlogs\/default\?tag=Ready$/));
  });

  it("shows the Unplaced column on the screen for an issue whose step is not in the backlog", async () => {
    open(client({ issues: async () => [...issues, issue("4", "Lost one", "Review")] }));
    expect(await within(await screen.findByRole("region", { name: "Unplaced" })).findByText("Lost one")).toBeInTheDocument();
    expect(within(column("To do")).queryByText("Lost one")).not.toBeInTheDocument();
  });

  it("links to the backlog page from the top bar", async () => {
    open(client());
    await screen.findByText("Record the clips");
    expect(screen.getByRole("link", { name: "Backlog" })).toHaveAttribute("href", expect.stringMatching(/\/backlogs\/default\/page$/));
  });

  it("says so when the backlog is not found or the read fails", async () => {
    open(client({ backlogs: async () => [] }));
    expect(await screen.findByText("This backlog could not be found.")).toBeInTheDocument();
  });

  it("shows the failure line when reading fails", async () => {
    open(client({ issues: async () => Promise.reject(new Error("down")) }));
    expect(await screen.findByRole("alert")).toHaveTextContent("The board could not be read");
  });
});
