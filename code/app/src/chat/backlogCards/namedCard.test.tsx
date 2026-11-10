import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../agency/open";
import { BacklogViewCard } from "./BacklogViewCard";
import { BacklogSummariesProvider, type BacklogSummary } from "./summaries";

const software: BacklogSummary = { id: "b1", name: "Software", steps: 6, issues: 5 };
const smart: BacklogSummary = { id: "s1", name: "walk-09b ready", steps: 0, issues: 3, smart: true };

const show = (targetId: string) =>
  render(
    <MemoryRouter>
      <BacklogSummariesProvider backlogs={[software, smart]} totals={{ issues: 8 }}>
        <BacklogViewCard targetId={targetId} />
      </BacklogSummariesProvider>
    </MemoryRouter>,
  );

beforeEach(() => openAgency("hub-steward-swe"));

afterEach(() => forgetOpenAgency());

describe("one backlog's own card", () => {
  it("is that backlog alone with an Open button to its board", () => {
    show("backlog:b1");
    expect(screen.getByText("Software")).toBeInTheDocument();
    expect(screen.queryByText("walk-09b ready")).toBeNull();
    expect(screen.getByText("5 issues in 6 steps")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open" })).toHaveAttribute("href", "/a/hub-steward-swe/backlogs/b1/board");
  });

  it("shows the Smart pill and opens the smart backlog's page", () => {
    show("backlog:s1");
    expect(screen.getByText("Smart")).toBeInTheDocument();
    expect(screen.getByText("3 issues")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open" })).toHaveAttribute("href", "/a/hub-steward-swe/backlogs/s1/smart");
  });
});
