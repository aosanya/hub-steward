import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { reviewAreaPages } from "../../data/menu";
import { areaOfPage } from "../../data/reviewApi";
import { ConsoleCtx } from "../../shell/context";
import { views } from "../views";
import { ReviewAreaView } from "./ReviewAreaView";

const reviewPage = vi.fn(
  (props: { hubId: string; kind: string; area?: string }) => (
    <div
      data-testid="review-page"
      data-hub={props.hubId}
      data-kind={props.kind}
      data-area={props.area ?? ""}
    />
  ),
);

vi.mock("../review/ReviewPageView", () => ({
  ReviewPageView: (props: { hubId: string; kind: string; area?: string }) =>
    reviewPage(props),
}));

const hub = { id: "h1", name: "Siaya farmers", kind: "farmers" } as never;

const shows = (page: string) =>
  render(
    <ConsoleCtx.Provider
      value={{
        hub,
        page,
        setBadges: () => undefined,
        refreshMenu: () => undefined,
      }}
    >
      <ReviewAreaView />
    </ConsoleCtx.Provider>,
  );

describe("the page of one area of the review", () => {
  it.each([
    ["review-profile", "profile"],
    ["review-goals", "goals"],
    ["review-objectives", "objectives"],
    ["review-roles", "roles_agents"],
    ["review-workflows", "workflows"],
    ["review-risks", "risks"],
    ["review-tests", "tests"],
  ])("opens the %s page on the %s area", (page, area) => {
    shows(page);

    expect(screen.getByTestId("review-page")).toHaveAttribute(
      "data-area",
      area,
    );
    expect(screen.getByTestId("review-page")).toHaveAttribute("data-hub", "h1");
  });
});

describe("the pages the menu lists under Review", () => {
  it.each(reviewAreaPages)(
    "%s is served by this view and names an area",
    (page) => {
      expect(views[page]).toBe(ReviewAreaView);
      expect(areaOfPage(page)).toBeDefined();
    },
  );
});
