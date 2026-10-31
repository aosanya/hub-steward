import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ReviewArea } from "../../data/reviewApi";
import { I18nProvider } from "../../i18n";
import { AreaBody } from "./AreaBody";
import { area, finding } from "./reviewFixtures";

vi.mock("./FindingRow", () => ({
  FindingRow: ({
    finding,
    onFinding,
  }: {
    finding: { id: string; title: string; status: string };
    onFinding: (finding: unknown) => void;
  }) => (
    <button
      type="button"
      data-testid="finding-row"
      data-status={finding.status}
      onClick={() => onFinding(finding)}
    >
      {finding.title}
    </button>
  ),
}));

vi.mock("./FailedTab", () => ({
  FailedTab: ({ area }: { area: { failure_reason: string } }) => (
    <div data-testid="failed-body">{area.failure_reason}</div>
  ),
}));

const words = {
  en: {
    "review.noFindings": "Nothing to fix in this part.",
    "review.reading": "Reading",
  },
};

const show = (
  row: ReviewArea,
  onFinding: (finding: unknown) => void = () => {},
) =>
  render(
    <I18nProvider initial={words}>
      <AreaBody hubId="h-1" row={row} onFinding={onFinding} />
    </I18nProvider>,
  );

describe("AreaBody", () => {
  it("shows the summary and one row per finding", () => {
    show(
      area("goals", {
        findings: [
          finding(),
          finding({ id: "f-2", title: "Give goal G-2 a number" }),
        ],
      }),
    );
    expect(
      screen.getByText(
        "Two sentences about this part. The second sentence says what to do first.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getAllByTestId("finding-row").map((el) => el.textContent),
    ).toEqual(["Describe Farmer R-47", "Give goal G-2 a number"]);
  });

  it("drops the findings a later review found fixed or withdrawn, and says nothing is left to fix when only those remain", () => {
    show(
      area("goals", {
        findings: [
          finding({ id: "f-1", title: "Still to do" }),
          finding({ id: "f-2", title: "Fixed one", fate: "fixed" }),
          finding({ id: "f-3", title: "Withdrawn one", fate: "withdrawn" }),
        ],
      }),
    );
    expect(screen.getAllByTestId("finding-row").map((el) => el.textContent)).toEqual(["Still to do"]);
  });

  it("says nothing is left to fix when every finding was fixed", () => {
    show(area("goals", { findings: [finding({ fate: "fixed" })] }));
    expect(screen.queryByTestId("finding-row")).toBeNull();
    expect(screen.getByText("Nothing to fix in this part.")).toBeInTheDocument();
  });

  it("keeps every finding visible whatever its status", () => {
    show(
      area("goals", {
        findings: [
          finding({ id: "f-1", title: "Open one", status: "open" }),
          finding({ id: "f-2", title: "Applied one", status: "applied" }),
          finding({ id: "f-3", title: "Dismissed one", status: "dismissed" }),
        ],
      }),
    );
    expect(
      screen.getAllByTestId("finding-row").map((el) => el.dataset.status),
    ).toEqual(["open", "applied", "dismissed"]);
  });

  it("leaves the summary out when the area has none", () => {
    show(area("goals", { summary: "", findings: [finding()] }));
    expect(screen.getAllByTestId("finding-row")).toHaveLength(1);
    expect(screen.queryByText(/Two sentences about this part/)).toBeNull();
  });

  it("says there is nothing to fix for an area without findings", () => {
    show(area("workflows"));
    expect(
      screen.getByText("Nothing to fix in this part."),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("finding-row")).toBeNull();
  });

  it("shows the failed body for a failed area and no rows", () => {
    show(
      area("risks", {
        status: "failed",
        failure_reason: "The risk register could not be read.",
        summary: "",
      }),
    );
    expect(screen.getByTestId("failed-body")).toHaveTextContent(
      "The risk register could not be read.",
    );
    expect(screen.queryByTestId("finding-row")).toBeNull();
  });

  it("says a part is still being read", () => {
    show(area("workflows", { status: "reading", summary: "" }));
    expect(screen.getByText("Reading")).toBeInTheDocument();
    expect(screen.queryByTestId("finding-row")).toBeNull();
  });

  it("passes onFinding through to the rows", async () => {
    const onFinding = vi.fn();
    show(
      area("goals", {
        findings: [finding({ id: "f-2", title: "Give goal G-2 a number" })],
      }),
      onFinding,
    );
    await userEvent.click(screen.getByText("Give goal G-2 a number"));
    expect(onFinding).toHaveBeenCalledTimes(1);
    expect(onFinding).toHaveBeenCalledWith(
      expect.objectContaining({ id: "f-2", title: "Give goal G-2 a number" }),
    );
  });
});
