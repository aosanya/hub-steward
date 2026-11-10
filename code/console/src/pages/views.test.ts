import { describe, expect, it } from "vitest";
import { views } from "./views";

describe("the console page views", () => {
  it("has a view for every page of the menu", () => {
    for (const page of ["status", "profile", "goals", "roles", "users", "groups", "agents", "publish", "publish-review", "usage", "usage-overview", "usage-work", "usage-agents", "models-configure", "assistant", "hazards", "threats", "consequences", "controls", "bowties", "objectives", "workflows", "test", "modules"]) {
      expect(views[page], page).toBeTypeOf("function");
    }
  });

  it("gives the review pages for the six areas one shared view", () => {
    const areas = ["review-profile", "review-goals", "review-objectives", "review-roles", "review-workflows", "review-risks", "review-tests"];
    expect(new Set(areas.map((page) => views[page])).size).toBe(1);
  });

  it("gives every Usage page its own view", () => {
    const usage = ["usage", "usage-overview", "usage-work", "usage-agents"].map((page) => views[page]);
    expect(new Set(usage).size).toBe(4);
  });

  it("has no view that is not a component", () => {
    for (const [page, view] of Object.entries(views)) expect(view, page).toBeTypeOf("function");
  });

  it("has no view for a page that does not exist", () => {
    expect(views.nothing).toBeUndefined();
  });
});
