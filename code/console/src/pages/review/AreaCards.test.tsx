import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { HubKind } from "../../data/hubKind";
import type { ReviewPage } from "../../data/reviewApi";
import { I18nProvider } from "../../i18n";
import { AreaCards } from "./AreaCards";
import {
  area,
  failedAreaPage,
  finding,
  page as fullPage,
  runningPage,
} from "./reviewFixtures";

const words = {
  en: {
    "menu.review-profile": "Profile",
    "menu.review-goals": "Goals",
    "menu.review-objectives": "Objectives",
    "menu.review-roles": "Roles",
    "menu.review-workflows": "Workflows",
    "menu.review-risks": "Risks",
    "menu.review-tests": "Tests",
    "review.openCount": "{n} open",
    "review.reading": "Reading",
    "review.failedTab": "Failed",
  },
};

const show = (kind: HubKind, page: ReviewPage) =>
  render(
    <MemoryRouter>
      <I18nProvider initial={words}>
        <AreaCards hubId="h-1" kind={kind} page={page} />
      </I18nProvider>
    </MemoryRouter>,
  );

const cards = () => screen.getAllByRole("link").map((link) => link.textContent);

describe("AreaCards", () => {
  it("draws one card per area in design order, with Objectives only for farmers", () => {
    show("farmers", fullPage());
    expect(cards()).toEqual([
      "Goals2 open",
      "Objectives0 open",
      "Roles0 open",
      "Workflows0 open",
      "Risks0 open",
      "Tests0 open",
    ]);
  });

  it("puts Profile first and links it to its own page", () => {
    show(
      "lab",
      fullPage({
        areas: [area("goals"), area("profile", { findings: [finding()] })],
      }),
    );
    expect(cards()).toEqual(["Profile1 open", "Goals0 open"]);
    expect(screen.getByRole("link", { name: /Profile/ })).toHaveAttribute(
      "href",
      "/h/h-1/review-profile",
    );
  });

  it("leaves Objectives out for the other kinds even when the area row exists", () => {
    show("lab", fullPage());
    expect(cards().map((card) => card?.replace(/\d+ open$/, ""))).toEqual([
      "Goals",
      "Roles",
      "Workflows",
      "Risks",
      "Tests",
    ]);
  });

  it("skips an area the review has no row for", () => {
    show(
      "riders",
      fullPage({
        areas: fullPage().areas.filter((row) => row.area !== "risks"),
      }),
    );
    expect(cards().map((card) => card?.replace(/\d+ open$/, ""))).toEqual([
      "Goals",
      "Roles",
      "Workflows",
      "Tests",
    ]);
  });

  it("counts only the open findings of an area", () => {
    const page = fullPage({
      areas: [
        area("goals", {
          findings: [
            finding(),
            finding({ id: "f-2", status: "applied" }),
            finding({ id: "f-3", status: "dismissed" }),
            finding({ id: "f-4" }),
          ],
        }),
      ],
    });
    show("farmers", page);
    expect(cards()).toEqual(["Goals2 open"]);
  });

  it("says Failed on a failed area and marks it bad", () => {
    show("farmers", failedAreaPage());
    const risks = screen.getByRole("link", { name: /Risks/ });
    expect(risks).toHaveTextContent("Failed");
    expect(risks).toHaveClass("bad");
  });

  it("says Reading on an area still being read and marks it muted", () => {
    show("farmers", runningPage(1));
    const tests = screen.getByRole("link", { name: /Tests/ });
    expect(tests).toHaveTextContent("Reading");
    expect(tests).toHaveClass("mute");
  });

  it("marks an area with nothing open ok, and one with findings open as a warning", () => {
    show("farmers", fullPage());
    expect(screen.getByRole("link", { name: /Objectives/ })).not.toHaveClass(
      "warn",
    );
    expect(screen.getByRole("link", { name: /Objectives/ })).not.toHaveClass(
      "bad",
    );
    expect(screen.getByRole("link", { name: /Goals/ })).toHaveClass("warn");
  });

  it("links each card to the page of its area under the hub", () => {
    show("farmers", fullPage());
    const hrefs = screen
      .getAllByRole("link")
      .map((link) => link.getAttribute("href"));
    expect(hrefs).toEqual([
      "/h/h-1/review-goals",
      "/h/h-1/review-objectives",
      "/h/h-1/review-roles",
      "/h/h-1/review-workflows",
      "/h/h-1/review-risks",
      "/h/h-1/review-tests",
    ]);
  });
});
