import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../agency/open";
import type { RoomMessage, RoomsClient } from "../rooms/api";
import { Attachment } from "../rooms/cards";
import { BacklogSummariesProvider, type BacklogSummary } from "./summaries";
import { backlogViewKind, backlogViewOf } from "./views";
import { backlogLine, issuesWords } from "./words";

const software: BacklogSummary = { id: "b1", name: "Software", steps: 6, issues: 5 };
const documentation: BacklogSummary = { id: "b2", name: "Documentation", steps: 5, issues: 1 };

const message = (targetId: string): RoomMessage => ({
  id: "m",
  author: "Triager",
  agent: true,
  mine: false,
  body: "",
  at: "2026-11-09T09:12:00Z",
  kind: backlogViewKind,
  targetId,
});

const show = (targetId: string, totals: { issues: number } | null = { issues: 83 }, ready = true) =>
  render(
    <MemoryRouter>
      <BacklogSummariesProvider backlogs={[software, documentation]} totals={totals} ready={ready}>
        <Attachment message={message(targetId)} threadLabel="General" client={{} as RoomsClient} openAsk={() => {}} />
      </BacklogSummariesProvider>
    </MemoryRouter>,
  );

beforeEach(() => openAgency("hub-steward-swe"));

afterEach(() => forgetOpenAgency());

describe("backlog view cards", () => {
  it("opens all issues with their number", () => {
    show("all");
    expect(screen.getByText("All issues")).toBeInTheDocument();
    expect(screen.getByText("83 issues")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open" })).toHaveAttribute("href", "/a/hub-steward-swe/backlogs/all");
  });

  it("shows all issues without a number before the totals are known", () => {
    show("all", null);
    expect(screen.getByText("All issues")).toBeInTheDocument();
    expect(screen.queryByText(/^\d+ issues?$/)).toBeNull();
  });

  it("opens one backlog with its steps and issues", () => {
    show("backlog:b1");
    expect(screen.getByText("Software")).toBeInTheDocument();
    expect(screen.getByText("5 issues in 6 steps")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open" })).toHaveAttribute("href", "/a/hub-steward-swe/backlogs/b1/board");
  });

  it("gives a button for each backlog", () => {
    show("backlogs");
    expect(screen.getByRole("link", { name: /Software/ })).toHaveAttribute("href", "/a/hub-steward-swe/backlogs/b1/board");
    expect(screen.getByRole("link", { name: /Documentation/ })).toHaveAttribute("href", "/a/hub-steward-swe/backlogs/b2/board");
    expect(screen.getByText("1 issue in 5 steps")).toBeInTheDocument();
  });

  it("says it could not be opened for a backlog it does not know or a target it cannot read", () => {
    const { unmount } = show("backlog:gone");
    expect(screen.getByText("This could not be opened.")).toBeInTheDocument();
    unmount();
    show("nonsense");
    expect(screen.getByText("This could not be opened.")).toBeInTheDocument();
  });

  it("says it could not be opened when no agency is open", () => {
    forgetOpenAgency();
    show("all");
    expect(screen.getByText("This could not be opened.")).toBeInTheDocument();
  });

  it("shows nothing for a backlog while the backlogs are still being read", () => {
    const { container } = show("backlog:gone", null, false);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("words and targets", () => {
  it("counts in singular and plural", () => {
    expect(issuesWords(1)).toBe("1 issue");
    expect(backlogLine(software)).toBe("5 issues in 6 steps");
  });

  it("reads a target", () => {
    expect(backlogViewOf("backlog:b1")).toEqual({ view: "backlog", backlogId: "b1" });
    expect(backlogViewOf("backlog:")).toBeNull();
  });
});
