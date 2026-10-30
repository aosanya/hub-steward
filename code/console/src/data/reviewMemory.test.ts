import { beforeEach, describe, expect, it } from "vitest";
import {
  clearProgress,
  loadProgress,
  loadReview,
  saveProgress,
  saveReview,
} from "./reviewMemory";

const review = {
  hubId: "h1",
  page: "objectives",
  id: 3,
  fill: {
    page: "objectives",
    summary: "Two overlap",
    items: [
      {
        title: "Merge",
        detail: "d",
        tool: "agency_update_objective",
        arguments: { objective_id: "o1" },
        then: [
          {
            tool: "agency_delete_objective",
            arguments: { objective_id: "o2" },
          },
        ],
      },
    ],
  },
};

beforeEach(() => window.localStorage.clear());

describe("the review kept for a hub", () => {
  it("comes back as it was saved, for that hub only", () => {
    saveReview("h1", review);

    expect(loadReview("h1")).toEqual(review);
    expect(loadReview("h2")).toBeNull();
  });

  it("is gone once cleared", () => {
    saveReview("h1", review);
    saveReview("h1", null);

    expect(loadReview("h1")).toBeNull();
  });

  it("gives a row saved before further changes existed an empty list of them", () => {
    window.localStorage.setItem(
      "chat.review.h1",
      JSON.stringify({
        ...review,
        fill: {
          ...review.fill,
          items: [
            { title: "Old", tool: "agency_update_objective", arguments: {} },
          ],
        },
      }),
    );

    expect(loadReview("h1")?.fill.items[0].then).toEqual([]);
  });

  it("is empty when what was stored is not a review", () => {
    window.localStorage.setItem("chat.review.h1", "nonsense");

    expect(loadReview("h1")).toBeNull();
  });
});

describe("what was applied and dismissed in a review", () => {
  it("is kept per review and can be cleared", () => {
    saveProgress("h1", 3, { done: [0], dismissed: [2] });

    expect(loadProgress("h1", 3)).toEqual({ done: [0], dismissed: [2] });
    expect(loadProgress("h1", 4)).toEqual({ done: [], dismissed: [] });
    clearProgress("h1", 3);
    expect(loadProgress("h1", 3)).toEqual({ done: [], dismissed: [] });
  });
});
