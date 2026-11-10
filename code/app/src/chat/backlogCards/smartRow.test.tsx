import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../agency/open";
import type { RoomMessage, RoomsClient } from "../rooms/api";
import { Attachment } from "../rooms/cards";
import { BacklogSummariesProvider, type BacklogSummary } from "./summaries";
import { backlogViewKind } from "./views";
import { backlogLine } from "./words";

const software: BacklogSummary = { id: "b1", name: "Software", steps: 6, issues: 5 };
const smart: BacklogSummary = { id: "s1", name: "walk-09 ready", steps: 0, issues: 3, smart: true };

const message: RoomMessage = {
  id: "m",
  author: "Triager",
  agent: true,
  mine: false,
  body: "",
  at: "2026-11-09T09:12:00Z",
  kind: backlogViewKind,
  targetId: "backlogs",
};

const show = () =>
  render(
    <MemoryRouter>
      <BacklogSummariesProvider backlogs={[smart, software]} totals={{ issues: 8 }}>
        <Attachment message={message} threadLabel="General" client={{} as RoomsClient} openAsk={() => {}} />
      </BacklogSummariesProvider>
    </MemoryRouter>,
  );

beforeEach(() => openAgency("hub-steward-swe"));

afterEach(() => forgetOpenAgency());

describe("a smart backlog on the Backlogs card", () => {
  it("reads only its count, with no step count", () => {
    expect(backlogLine(smart)).toBe("3 issues");
    expect(backlogLine(software)).toBe("5 issues in 6 steps");
  });

  it("shows the Smart pill and opens its own page, while a backlog with steps opens its board", () => {
    show();
    expect(screen.getByText("Smart")).toBeInTheDocument();
    expect(screen.queryByText(/0 steps/)).toBeNull();
    expect(screen.getByRole("link", { name: /walk-09 ready/ })).toHaveAttribute("href", "/a/hub-steward-swe/backlogs/s1/smart");
    expect(screen.getByRole("link", { name: /Software/ })).toHaveAttribute("href", "/a/hub-steward-swe/backlogs/b1/board");
  });
});
