import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { openAgency } from "../../../shared/wakala/openAgency";
import { BacklogBoard } from "../board/BacklogBoard";
import { IssuePage } from "./IssuePage";
import { IssuesPage } from "./IssuesPage";
import type { Backlog, BacklogsClient, Issue, IssueDetail } from "../shared/api";

const issue = (id: string, title: string, over: Partial<Issue> = {}): Issue => ({
  id,
  title,
  description: "Text",
  status: "pending",
  step: "To do",
  repo: "hub-steward",
  topics: ["Docs"],
  backlog: "Backlog",
  mark: "Ready",
  rank: 1,
  ...over,
});

const one = issue("1", "DEV-009 Create the tables");
const other = issue("2", "DEV-010 Fix the route");
const backlog: Backlog = { id: "backlog", name: "Backlog", steps: ["To do", "Done"], issues: 2 };
const detail: IssueDetail = { ...one, waitsOn: [other], waitedOnBy: [issue("3", "DEV-011 Follow up")] };

const client: BacklogsClient = { backlogs: async () => [backlog], issues: async () => [one, other], issue: async () => detail };

const at = (path: string, element: JSX.Element, route: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={route} element={element} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => openAgency({ id: "hub-1", name: "Hub" } as never));

describe("every place that shows an issue draws it through the one shared row", () => {
  it("the list of all issues and a search result", async () => {
    at("/a/hub-1/backlogs/all?q=route&view=list", <IssuesPage client={client} />, "/a/:agencyId/backlogs/:backlogId");
    await screen.findByText("DEV-010");
    expect(document.querySelectorAll(".issue-cards > .issue-row")).toHaveLength(1);
  });

  it("the cards of the board", async () => {
    at("/a/hub-1/backlogs/backlog/board", <BacklogBoard client={client} />, "/a/:agencyId/backlogs/:backlogId/board");
    await screen.findByText("DEV-009");
    const cards = document.querySelectorAll(".bb-col > .issue-row");
    expect(cards).toHaveLength(2);
    cards.forEach((card) => expect(card.querySelector(":scope > .card")).not.toBeNull());
  });

  it("the top of an issue's page, what it waits on and what waits on it", async () => {
    at("/a/hub-1/backlogs/issue/1", <IssuePage client={client} />, "/a/:agencyId/backlogs/issue/:issueId");
    await screen.findByText("Waits on");
    expect(screen.getByRole("heading", { level: 1, name: "Create the tables" })).toBeInTheDocument();
    expect(document.querySelectorAll(".issue-main > .sec")).toHaveLength(1);
    expect(document.querySelectorAll(".issue-row.static")).toHaveLength(0);
    expect(document.querySelectorAll(".issue-side .card .issue-row")).toHaveLength(2);
    expect(screen.getByText("Waited on by")).toBeInTheDocument();
  });

  it("the top of an issue's page is the Details card of the one shared Section, over its tags", async () => {
    at("/a/hub-1/backlogs/issue/1", <IssuePage client={client} />, "/a/:agencyId/backlogs/issue/:issueId");
    await screen.findByText("Waits on");
    const details = document.querySelector(".issue-main > .sec") as HTMLElement;
    expect(details.querySelector(".sec-title")).toHaveTextContent("Details");
    expect(details.querySelector(".sec-body .issue-tags")).not.toBeNull();
    expect(document.querySelector(".issue-main .issue-body")).toHaveTextContent("Text");
    expect(details.querySelector(".issue-row")).toBeNull();
  });
});
