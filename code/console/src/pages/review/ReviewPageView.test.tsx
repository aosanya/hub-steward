import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Finding, ReviewArea, ReviewPage } from "../../data/reviewApi";
import { I18nProvider } from "../../i18n";
import { ReviewPageView } from "./ReviewPageView";
import { useReview } from "./useReview";

vi.mock("./useReview", () => ({ useReview: vi.fn() }));
vi.mock("./RunCard", () => ({
  RunCard: ({
    onRun,
    busy,
    refusal,
  }: {
    onRun: () => void;
    busy: boolean;
    refusal: string;
  }) => (
    <div data-testid="run-card" data-busy={String(busy)}>
      <button onClick={onRun}>Run review</button>
      {refusal}
    </div>
  ),
}));
vi.mock("./ProgressCard", () => ({
  ProgressCard: ({
    progress,
  }: {
    progress: { done: number; total: number };
  }) => (
    <div data-testid="progress-card">{`Reading ${progress.done} of ${progress.total}`}</div>
  ),
}));
vi.mock("./AreaCards", () => ({
  AreaCards: ({ hubId, kind }: { hubId: string; kind: string }) => (
    <div data-testid="area-cards" data-hub={hubId} data-kind={kind} />
  ),
}));
vi.mock("./AreaBody", () => ({
  AreaBody: ({
    hubId,
    row,
    onFinding,
  }: {
    hubId: string;
    row: { area: string };
    onFinding: (f: Finding) => void;
  }) => (
    <div data-testid="area-body" data-hub={hubId} data-area={row.area}>
      <button onClick={() => onFinding({ id: "f-1" } as Finding)}>
        Change a finding
      </button>
    </div>
  ),
}));

const words = {
  en: {
    "menu.publish-review": "Review",
    "menu.review-goals": "Goals",
    "review.noFindings": "Nothing to fix in this part.",
    "review.areaTitle": "Review: {area}",
    "review.runAgain": "Run review again",
    "review.runAreaAgain": "Review {area} again",
    "review.runArea": "Review {area}",
    "review.areaEmpty": "{area} has not been reviewed yet.",
    "review.progressArea": "Reading {area}",
    "review.loadFailed": "The review could not be loaded.",
  },
};

const area = (
  name: ReviewArea["area"],
  status: ReviewArea["status"],
): ReviewArea => ({
  id: `a-${name}`,
  review_id: "rv-1",
  area: name,
  status,
  failure_reason: "",
  summary: "",
  tokens: 0,
  findings: [],
});

const pageWith = (
  review: "running" | "done",
  statuses: ReviewArea["status"][],
): ReviewPage => ({
  review: {
    id: "rv-1",
    draft_id: "d-1",
    status: review,
    previous_review_id: "",
    started_by: "Designer",
    started_at: "2026-10-31T08:58:00Z",
    finished_at: review === "done" ? "2026-10-31T08:59:00Z" : "",
    tokens: 0,
  },
  areas: statuses.map((status, i) =>
    area(
      (["goals", "roles_agents", "workflows", "risks", "tests"] as const)[i],
      status,
    ),
  ),
});

const start = vi.fn(() => Promise.resolve());
const replaceFinding = vi.fn();

const shows = (
  over: Partial<ReturnType<typeof useReview>>,
  area?: ReviewArea["area"],
) => {
  vi.mocked(useReview).mockReturnValue({
    page: null,
    state: "ready",
    error: "",
    starting: false,
    start,
    replaceFinding,
    ...over,
  });
  return render(
    <I18nProvider initial={words}>
      <ReviewPageView hubId="h1" kind="farmers" area={area} />
    </I18nProvider>,
  );
};

const runAgain = () =>
  screen.queryByRole("button", { name: "Run review again" });

beforeEach(() => {
  start.mockClear();
  replaceFinding.mockClear();
  vi.mocked(useReview).mockReset();
});

describe("the Review page while it loads", () => {
  it("shows the title row alone", () => {
    shows({ state: "loading" });

    expect(
      screen.getByRole("heading", { level: 1, name: "Review" }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("run-card")).not.toBeInTheDocument();
    expect(screen.queryByTestId("progress-card")).not.toBeInTheDocument();
    expect(screen.queryByTestId("area-cards")).not.toBeInTheDocument();
    expect(runAgain()).not.toBeInTheDocument();
  });

  it("reads the review of the hub it was given", () => {
    shows({ state: "loading" });

    expect(useReview).toHaveBeenCalledWith("h1", undefined);
  });
});

describe("the Review page when the review cannot be read", () => {
  it("says the review could not be loaded as a failed empty card", () => {
    shows({ state: "failed" });

    expect(screen.getByText("The review could not be loaded.")).toHaveClass(
      "empty",
      "error",
    );
    expect(runAgain()).not.toBeInTheDocument();
  });

  it("says the sentence the reader gave when there is one", () => {
    shows({ state: "failed", error: "the review is down" });

    expect(screen.getByText("the review is down")).toHaveClass(
      "empty",
      "error",
    );
    expect(
      screen.queryByText("The review could not be loaded."),
    ).not.toBeInTheDocument();
  });
});

describe("the Review page with no review", () => {
  it("shows the run card and runs the review from it", async () => {
    shows({ page: null, error: "no model key yet", starting: true });

    const card = screen.getByTestId("run-card");
    expect(card).toHaveAttribute("data-busy", "true");
    expect(card).toHaveTextContent("no model key yet");
    await userEvent.click(screen.getByRole("button", { name: "Run review" }));
    expect(start).toHaveBeenCalledTimes(1);
  });

  it("has no Run review again button", () => {
    shows({ page: null });

    expect(runAgain()).not.toBeInTheDocument();
    expect(screen.queryByTestId("area-cards")).not.toBeInTheDocument();
  });
});

describe("the Review page while the reviewers read", () => {
  it("shows the progress card and nothing else", () => {
    shows({
      page: pageWith("running", [
        "done",
        "done",
        "reading",
        "reading",
        "reading",
      ]),
    });

    expect(screen.getByTestId("progress-card")).toHaveTextContent(
      "Reading 2 of 5",
    );
    expect(screen.queryByTestId("area-cards")).not.toBeInTheDocument();
    expect(screen.queryByTestId("run-card")).not.toBeInTheDocument();
  });

  it("has no Run review again button", () => {
    shows({
      page: pageWith("running", [
        "done",
        "reading",
        "reading",
        "reading",
        "reading",
      ]),
    });

    expect(runAgain()).not.toBeInTheDocument();
  });

  it("keeps the cards away while the review still runs, even if every part already reports done", () => {
    shows({
      page: pageWith("running", ["done", "done", "done", "done", "done"]),
    });

    expect(screen.getByTestId("progress-card")).toHaveTextContent(
      "Reading 5 of 5",
    );
    expect(screen.queryByTestId("area-cards")).not.toBeInTheDocument();
  });
});

describe("the Review page with a finished review", () => {
  const done = () => pageWith("done", ["done", "done", "done", "done", "done"]);

  it("shows the area cards for the hub and its kind, and no run card, progress card or area body", () => {
    shows({ page: done() });

    const cards = screen.getByTestId("area-cards");
    expect(cards).toHaveAttribute("data-hub", "h1");
    expect(cards).toHaveAttribute("data-kind", "farmers");
    expect(screen.queryByTestId("area-body")).not.toBeInTheDocument();
    expect(screen.queryByTestId("progress-card")).not.toBeInTheDocument();
    expect(screen.queryByTestId("run-card")).not.toBeInTheDocument();
  });

  it("starts the review again from the title row button", async () => {
    shows({
      page: pageWith("done", ["done", "failed", "done", "done", "done"]),
    });

    await userEvent.click(
      screen.getByRole("button", { name: "Run review again" }),
    );

    expect(start).toHaveBeenCalledTimes(1);
  });

  it("holds the button while a run is starting", async () => {
    shows({ page: done(), starting: true });

    await userEvent.click(
      screen.getByRole("button", { name: "Run review again" }),
    );

    expect(start).not.toHaveBeenCalled();
  });

  it("says why a new run was refused above the cards", () => {
    shows({ page: done(), error: "a review is already running" });

    expect(screen.getByText("a review is already running")).toHaveClass(
      "empty",
      "error",
    );
    expect(screen.getByTestId("area-cards")).toBeInTheDocument();
  });
});

describe("the page of one area of a finished review", () => {
  const done = () => pageWith("done", ["done", "done", "done", "done", "done"]);

  it("is titled for the area and shows that area's findings, not the cards", () => {
    shows({ page: done() }, "goals");

    expect(
      screen.getByRole("heading", { level: 1, name: "Review: Goals" }),
    ).toBeInTheDocument();
    const body = screen.getByTestId("area-body");
    expect(body).toHaveAttribute("data-hub", "h1");
    expect(body).toHaveAttribute("data-area", "goals");
    expect(screen.queryByTestId("area-cards")).not.toBeInTheDocument();
  });

  it("hands a changed finding to replaceFinding", async () => {
    shows({ page: done() }, "goals");

    await userEvent.click(
      screen.getByRole("button", { name: "Change a finding" }),
    );

    expect(replaceFinding).toHaveBeenCalledWith({ id: "f-1" });
  });

  it("starts the review again from the title row button", async () => {
    shows({ page: done() }, "goals");

    await userEvent.click(
      screen.getByRole("button", { name: "Review Goals again" }),
    );

    expect(start).toHaveBeenCalledTimes(1);
    expect(runAgain()).not.toBeInTheDocument();
  });

  it("offers to review the area when the review has no row for it yet", () => {
    shows({ page: done() }, "objectives");

    expect(screen.getByTestId("run-card")).toBeInTheDocument();
    expect(screen.queryByTestId("area-body")).not.toBeInTheDocument();
  });

  it("still shows the run card, progress and failed states on an area page", () => {
    shows({ page: null }, "goals");
    expect(screen.getByTestId("run-card")).toBeInTheDocument();
  });
});
