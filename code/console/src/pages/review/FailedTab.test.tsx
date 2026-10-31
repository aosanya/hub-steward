import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ReviewArea } from "../../data/reviewApi";
import { I18nProvider } from "../../i18n";
import { FailedTab } from "./FailedTab";

const words = { en: { "review.failedTab": "Failed" } };

const failedArea: ReviewArea = {
  id: "a-risks",
  review_id: "rv-1",
  area: "risks",
  status: "failed",
  failure_reason: "The risk register could not be read.",
  summary: "",
  tokens: 0,
  findings: [],
};

describe("a part that could not be read", () => {
  it("shows a Failed chip and the reason sentence", () => {
    render(
      <I18nProvider initial={words}>
        <FailedTab area={failedArea} />
      </I18nProvider>,
    );

    expect(screen.getByText("Failed")).toHaveClass("tag", "bad");
    expect(screen.getByText("The risk register could not be read.")).toBeInTheDocument();
  });

  it("shows nothing else", () => {
    const { container } = render(
      <I18nProvider initial={words}>
        <FailedTab area={failedArea} />
      </I18nProvider>,
    );

    expect(container.textContent).toBe("FailedThe risk register could not be read.");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
