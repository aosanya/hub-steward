import { beforeEach, describe, expect, it, vi } from "vitest";
import { workingDraftId } from "./draft";
import { getReview } from "./reviewApi";
import { loadReviewBadges } from "./reviewBadges";
import { area, finding, page } from "../pages/review/reviewFixtures";

vi.mock("./draft", () => ({ workingDraftId: vi.fn() }));
vi.mock("./reviewApi", () => ({ getReview: vi.fn() }));

beforeEach(() => {
  vi.mocked(workingDraftId).mockReset().mockResolvedValue("d-1");
  vi.mocked(getReview).mockReset();
});

describe("the open findings counted for the menu", () => {
  it("counts the open findings of each part under that part's page, leaving out parts with none", async () => {
    vi.mocked(getReview).mockResolvedValue(
      page({
        areas: [
          area("goals", { findings: [finding(), finding({ id: "f-2" }), finding({ id: "f-3", status: "dismissed" })] }),
          area("roles_agents", { findings: [finding({ id: "f-4" })] }),
          area("risks", { findings: [finding({ id: "f-5", status: "applied" })] }),
          area("tests"),
        ],
      }),
    );

    expect(await loadReviewBadges("h1")).toEqual({ "review-goals": 2, "review-roles": 1 });
    expect(getReview).toHaveBeenCalledWith("h1", { draftId: "d-1" });
  });

  it("leaves out the findings the review found fixed or withdrawn", async () => {
    vi.mocked(getReview).mockResolvedValue(
      page({
        areas: [area("goals", { findings: [finding(), finding({ id: "f-2", fate: "fixed" }), finding({ id: "f-3", fate: "withdrawn" })] })],
      }),
    );

    expect(await loadReviewBadges("h1")).toEqual({ "review-goals": 1 });
  });

  it("answers nothing when the draft has not been reviewed", async () => {
    vi.mocked(getReview).mockResolvedValue(null);
    expect(await loadReviewBadges("h1")).toEqual({});
  });

  it("answers nothing, and asks for no review, when there is no open draft", async () => {
    vi.mocked(workingDraftId).mockResolvedValue("");
    expect(await loadReviewBadges("h1")).toEqual({});
    expect(getReview).not.toHaveBeenCalled();
  });
});
